// controllers/invoiceController.js
import { supabase } from "../utils/supabaseClient.js";

/* --------------------------------------------------------------
   Helper: Generate next invoice number (INV-0001, INV-0002, …)
   -------------------------------------------------------------- */
async function generateInvoiceNumber(userId) {
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", userId)
    .order("invoice_number", { ascending: false })
    .limit(1);

  if (error) {
    console.error("generateInvoiceNumber error:", error);
    throw new Error("Failed to generate invoice number");
  }

  if (!data || data.length === 0) return "INV-0001";

  const last = data[0].invoice_number; // e.g. "INV-0012"
  const num = parseInt(last.split("-")[1], 10) || 0;
  return `INV-${String(num + 1).padStart(4, "0")}`;
}

/* --------------------------------------------------------------
   CREATE INVOICE
   -------------------------------------------------------------- */
export const createInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      client_id,
      issue_date,
      due_date,
      invoice_items = [],
      status = "draft",
    } = req.body;

    // ── Validation ────────────────────────────────────────
    if (!client_id || !issue_date || !due_date) {
      return res.status(400).json({
        error: "client_id, issue_date and due_date are required",
      });
    }

    if (!Array.isArray(invoice_items) || invoice_items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }

    // Validate each item
    for (const item of invoice_items) {
      if (!item.description || item.quantity <= 0 || item.unit_price < 0) {
        return res
          .status(400)
          .json({
            error:
              "Invalid item: description, quantity > 0, unit_price >= 0 required",
          });
      }
    }

    // ── Generate invoice number ───────────────────────────
    const invoice_number = await generateInvoiceNumber(userId);

    // ── Insert invoice (total_amount = 0 for now) ───────────
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        client_id,
        invoice_number,
        issue_date,
        due_date,
        total_amount: 0,
        status,
      })
      .select()
      .single();

    if (invErr) {
      if (invErr.code === "23505") {
        return res
          .status(409)
          .json({ error: "Invoice number conflict – try again" });
      }
      throw invErr;
    }

    // ── Insert items & calculate total ─────────────────────
    const itemsPayload = invoice_items.map((i) => ({
      invoice_id: invoice.id,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }));

    const { error: itemsErr } = await supabase
      .from("invoice_items")
      .insert(itemsPayload);

    if (itemsErr) throw itemsErr;

    const calculatedTotal = invoice_items.reduce(
      (sum, i) => sum + i.quantity * i.unit_price,
      0
    );

    // ── Update invoice with correct total ───────────────────
    const { data: updatedInvoice, error: updErr } = await supabase
      .from("invoices")
      .update({ total_amount: calculatedTotal })
      .eq("id", invoice.id)
      .select()
      .single();

    if (updErr) throw updErr;

    // ── Fetch full invoice with client & items ─────────────
    const { data: fullInvoice } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        issue_date,
        due_date,
        total_amount,
        status,
        created_at,
        clients!invoices_client_id_fkey (
          id,
          name,
          email,
          phone,
          address
        ),
        invoice_items (
          id,
          description,
          quantity,
          unit_price,
          total
        )
      `
      )
      .eq("id", updatedInvoice.id)
      .single();

    res.status(201).json({
      message: "Invoice created successfully",
      invoice: fullInvoice,
    });
  } catch (err) {
    console.error("createInvoice error:", err);
    res.status(500).json({ error: err.message || "Failed to create invoice" });
  }
};

/* --------------------------------------------------------------
   GET INVOICE SUMMARIES
   -------------------------------------------------------------- */
export const getInvoices = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        issue_date,
        due_date,
        total_amount,
        status,
        created_at,
        clients!invoices_client_id_fkey (
          id,
          name
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).json({ invoices: data || [] });
  } catch (err) {
    console.error("getInvoices error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* --------------------------------------------------------------
   GET SINGLE INVOICE BY ID
   -------------------------------------------------------------- */
export const getInvoiceById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        issue_date,
        due_date,
        total_amount,
        status,
        created_at,
        clients!invoices_client_id_fkey (
          id,
          name,
          email,
          phone,
          address
        ),
        invoice_items (
          id,
          description,
          quantity,
          unit_price,
          total
        )
      `
      )
      .eq("user_id", userId)
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.status(200).json({ invoice: data });
  } catch (err) {
    console.error("getInvoiceById error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* --------------------------------------------------------------
   UPDATE INVOICE
   -------------------------------------------------------------- */
export const updateInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status, due_date, invoice_items } = req.body;

    const updates = {};
    if (status) updates.status = status;
    if (due_date) updates.due_date = due_date;

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (invErr) throw invErr;

    let newTotal = invoice.total_amount;

    if (Array.isArray(invoice_items) && invoice_items.length > 0) {
      // Delete old items
      await supabase.from("invoice_items").delete().eq("invoice_id", id);

      const validItems = invoice_items.filter(
        (i) => i.description && i.quantity > 0 && i.unit_price >= 0
      );

      if (validItems.length > 0) {
        const payload = validItems.map((i) => ({
          invoice_id: id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }));

        const { error: itemsErr } = await supabase
          .from("invoice_items")
          .insert(payload);
        if (itemsErr) throw itemsErr;

        newTotal = validItems.reduce(
          (s, i) => s + i.quantity * i.unit_price,
          0
        );
      } else {
        newTotal = 0;
      }

      await supabase
        .from("invoices")
        .update({ total_amount: newTotal })
        .eq("id", id);
    }

    const { data: fresh } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        issue_date,
        due_date,
        total_amount,
        status,
        created_at,
        clients!invoices_client_id_fkey (id, name, email, phone, address),
        invoice_items (*)
      `
      )
      .eq("id", id)
      .single();

    res.status(200).json({ message: "Invoice updated", invoice: fresh });
  } catch (err) {
    console.error("updateInvoice error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* --------------------------------------------------------------
   DELETE INVOICE
   -------------------------------------------------------------- */
export const deleteInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    res.status(200).json({ message: "Invoice deleted successfully" });
  } catch (err) {
    console.error("deleteInvoice error:", err);
    res.status(500).json({ error: err.message });
  }
};
