/* --------------------------------------------------------------
   paymentController.js
   -------------------------------------------------------------- */
import { supabase } from "../utils/supabaseClient.js";

/* --------------------------------------------------------------
   GET ALL PAYMENTS (via view)
   -------------------------------------------------------------- */
export const getPayments = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("payment_view")
      .select("*")
      .eq("user_id", userId)
      .order("paid_at", { ascending: false });

    if (error) throw error;

    // No flattening needed – view is flat
    res.json({ payments: data });
  } catch (err) {
    console.error("getPayments error:", err);
    res.status(500).json({ error: err.message || "Failed to load payments" });
  }
};

/* --------------------------------------------------------------
   GET SINGLE PAYMENT BY ID (via view)
   -------------------------------------------------------------- */
export const getPaymentById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("payment_view")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.status(200).json({ payment: data });
  } catch (err) {
    console.error("getPaymentById error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Used by the legacy Checkout return URL, which includes an invoice ID only.
export const getPaymentByInvoiceId = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", req.user.id)
      .eq("invoice_id", req.params.invoiceId)
      .eq("status", "succeeded")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "No completed payment found" });
    return res.json({ payment: data });
  } catch (err) {
    console.error("getPaymentByInvoiceId error:", err);
    return res.status(500).json({ error: "Unable to load payment receipt" });
  }
};
