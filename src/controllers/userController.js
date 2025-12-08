// controllers/userController.js
import { supabase } from "../utils/supabaseClient.js";
import { Buffer } from "buffer";

/**
 * GET /api/user/profile
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("users")
      .select(
        `
        id,
        email,
        full_name,
        company_name,
        role,
        profile_image,
        created_at,
        updated_at
      `
      )
      .eq("id", userId)
      .single();

    if (error) throw error;

    res.status(200).json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/user/profile
 * Supports: full_name, company_name, role, profile_image (base64)
 */

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, company_name, role, profile_image } = req.body;

    // Get existing image for potential deletion later
    const { data: existing, error: existingErr } = await supabase
      .from("users")
      .select("profile_image")
      .eq("id", userId)
      .single();

    if (existingErr)
      console.warn("Could not fetch existing profile:", existingErr);

    let imageUrl = null;

    // ✅ Handle base64 image upload
    if (profile_image && profile_image.startsWith("data:image")) {
      const base64Data = profile_image.split(",")[1];
      const mimeType = profile_image.split(";")[0].split(":")[1] || "image/png";
      const fileExt = mimeType.split("/")[1] || "png";
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;
      const buffer = Buffer.from(base64Data, "base64");

      // Optional: file size limit (10MB)
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(413).json({ error: "Image too large (max 10MB)" });
      }

      // ✅ FIX: Add duplex: "half" to satisfy Node fetch body requirement
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("profilePictures")
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true,
          duplex: "half",
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("profilePictures")
        .getPublicUrl(fileName);

      imageUrl = urlData?.publicUrl ?? null;
    }

    // ✅ Build update payload
    const updates = {
      updated_at: new Date(),
      ...(full_name && { full_name }),
      ...(company_name && { company_name }),
      ...(role && { role }),
      ...(imageUrl && { profile_image: imageUrl }),
    };

    // ✅ Update the user
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    // ✅ Remove old image (non-blocking)
    if (
      imageUrl &&
      existing?.profile_image &&
      existing.profile_image !== imageUrl
    ) {
      try {
        const oldUrl = existing.profile_image;
        const parts = oldUrl.split("/");
        const oldFile = parts.slice(-2).join("/"); // userId/filename.png
        await supabase.storage.from("profilePictures").remove([oldFile]);
      } catch (delErr) {
        console.warn(
          "Failed to delete old profile image:",
          delErr.message || delErr
        );
      }
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: data,
    });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};
