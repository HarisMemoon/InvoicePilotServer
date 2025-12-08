import { supabase } from "../utils/supabaseClient.js";

export const createClient = async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const userId = req.user.id; // verified from middleware

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const { data, error } = await supabase
      .from("clients")
      .insert([{ user_id: userId, name, email, phone, address }])
      .select()
      .single();

    if (error) throw error;

    res
      .status(201)
      .json({ message: "Client created successfully", client: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getClients = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.status(200).json({ clients: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address } = req.body;
    const userId = req.user.id;

    if (!id) return res.status(400).json({ error: "Client ID is required" });

    const { data, error } = await supabase
      .from("clients")
      .update({ name, email, phone, address })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Client not found" });

    res
      .status(200)
      .json({ message: "Client updated successfully", client: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) return res.status(400).json({ error: "Client ID is required" });

    // Delete only if it belongs to the logged-in user
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    res.status(200).json({ message: "Client deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
