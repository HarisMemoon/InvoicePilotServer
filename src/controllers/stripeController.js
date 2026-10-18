// controllers/stripeController.js
import Stripe from "stripe";
import { supabaseAdmin } from "../utils/supabaseClient.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// 1. Create Checkout Session
export const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { invoice_id } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: "invoice_id is required" });
    }

    // NOTE: `status` is selected on purpose — the already-paid check below
    // is dead code without it.
    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        total_amount,
        status,
        clients (email, name)
      `,
      )
      .eq("id", invoice_id)
      .eq("user_id", userId)
      .single();

    if (error || !invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (invoice.status === "paid") {
      return res.status(400).json({ error: "Invoice already paid" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: invoice.clients?.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `Payment for ${invoice.clients?.name || "Client"}`,
            },
            unit_amount: Math.round(invoice.total_amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/dashboard/invoices?paid=${invoice.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/invoices?canceled=${invoice.id}`,
      metadata: {
        invoice_id: invoice.id,
        user_id: userId,
      },
      payment_intent_data: {
        metadata: { invoice_id: invoice.id, user_id: userId },
      },
      client_reference_id: invoice.id,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err);
    res.status(500).json({ error: "Could not start checkout" });
  }
};

// 2. Webhook — public route, no auth middleware. Signature is the auth.
export const stripeWebhook = async (req, res) => {
  let event;

  try {
    const sig = req.headers["stripe-signature"];
    if (!sig) return res.status(400).send("Missing stripe-signature");

    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Only handle payment-completion events. Ack everything else with 200
  // so Stripe does not retry them.
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return res.json({ received: true });
  }

  const session = event.data.object;
  const invoice_id = session.metadata?.invoice_id;
  const user_id = session.metadata?.user_id;

  // Missing metadata can never be fixed by a retry — ack with 200.
  if (!invoice_id || !user_id) {
    console.error("Webhook missing metadata", { eventId: event.id });
    return res.json({ received: true });
  }

  // PaymentIntent ids may arrive as string or nested object.
  const payment_intent_id =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  try {
    await handleCheckoutCompleted({
      invoice_id,
      user_id,
      session,
      payment_intent_id,
    });
    res.json({ received: true });
  } catch (err) {
    // 500 -> Stripe retries the webhook later. Correct for transient DB errors.
    console.error("Webhook processing failed:", err);
    return res.status(500).json({ error: "Processing failed" });
  }
};

async function handleCheckoutCompleted({
  invoice_id,
  user_id,
  session,
  payment_intent_id,
}) {
  // Idempotency: if this payment was already recorded, do nothing.
  if (payment_intent_id) {
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("stripe_payment_id", payment_intent_id)
      .maybeSingle();
    if (existing) return;
  }

  // Verify the invoice belongs to this user and is not already paid.
  const { data: invoice, error: invFetchErr } = await supabaseAdmin
    .from("invoices")
    .select("id, total_amount, status, user_id")
    .eq("id", invoice_id)
    .single();

  if (invFetchErr || !invoice) throw new Error("Invoice not found in webhook");
  if (invoice.user_id !== user_id) throw new Error("Invoice user mismatch");
  if (invoice.status === "paid") return; // already handled

  // Never trust the amount from Stripe alone — compare with the DB.
  const expected = Math.round(Number(invoice.total_amount) * 100);
  if (session.amount_total !== expected) {
    throw new Error(
      `Amount mismatch: stripe=${session.amount_total} db=${expected}`,
    );
  }
  if (session.payment_status !== "paid") {
    throw new Error(`Payment not completed: ${session.payment_status}`);
  }

  // Atomic update: invoice -> paid AND payment row inserted together.
  // Run sql/mark_invoice_paid.sql in the Supabase SQL editor first.
  const { error: rpcErr } = await supabaseAdmin.rpc("mark_invoice_paid", {
    p_invoice_id: invoice_id,
    p_user_id: user_id,
    p_stripe_payment_id: payment_intent_id || null,
    p_amount: (session.amount_total || 0) / 100,
    p_paid_at: new Date().toISOString(),
  });

  if (rpcErr) throw rpcErr;
}
