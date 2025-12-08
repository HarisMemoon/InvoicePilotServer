// controllers/stripeController.js
import Stripe from "stripe";
import { supabase } from "../utils/supabaseClient.js";

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

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        total_amount,
        clients (email, name)
      `
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
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 2. Webhook
export const stripeWebhook = async (req, res) => {
  let event;

  try {
    const sig = req.headers["stripe-signature"];
    if (!sig) return res.status(400).send("Missing stripe-signature");

    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type !== "checkout.session.completed") {
    return res.json({ received: true });
  }

  const session = event.data.object;
  const invoice_id = session.metadata?.invoice_id;
  const user_id = session.metadata?.user_id;

  if (!invoice_id || !user_id) {
    return res.status(400).json({ error: "Invalid metadata" });
  }

  const amount_total = (session.amount_total || 0) / 100;
  const stripe_payment_id = session.payment_intent;
  const paid_at = new Date().toISOString();

  try {
    // Update invoice
    const { error: invErr } = await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", invoice_id)
      .eq("user_id", user_id);

    if (invErr) throw invErr;

    // Insert payment
    const { data: payment, error: payErr } = await supabase
      .from("payments")
      .insert({
        invoice_id,
        user_id,
        stripe_payment_id,
        amount: amount_total,
        status: "succeeded",
        paid_at,
      })
      .select()
      .single();

    if (payErr) {
      console.error("Payment insert failed:", payErr);
    } else {
      await supabase
        .from("invoices")
        .update({ payment_id: payment.id })
        .eq("id", invoice_id);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook processing failed:", err);
    return res.status(500).json({ error: "Processing failed" });
  }
};
