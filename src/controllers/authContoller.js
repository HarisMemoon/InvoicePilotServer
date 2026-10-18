// NOTE: filename keeps the historic typo (authContoller) so existing
// imports don't break. Renaming is optional cleanup.
import { z } from "zod";
import { supabaseAdmin, createAuthClient } from "../utils/supabaseClient.js";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = authSchema.extend({
  full_name: z.string().min(1),
  company_name: z.string().optional().nullable(),
});

export const signup = async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid signup data" });
  }
  const { full_name, email, password, company_name } = parsed.data;

  try {
    const authClient = createAuthClient();

    // 1. Sign up in auth.users (throwaway client — no shared session)
    const { data, error } = await authClient.auth.signUp({
      email,
      password,
      options: { data: { full_name, company_name } },
    });

    if (error) throw error;
    if (!data.user) throw new Error("User creation failed");

    // 2. Insert into public.users
    const { error: dbError } = await supabaseAdmin.from("users").upsert({
      id: data.user.id,
      email: data.user.email,
      full_name,
      company_name: company_name || null,
    });

    if (dbError) {
      console.error("DB Insert Error:", dbError);
      throw dbError;
    }

    // 3. Return session + user (same shape the frontend expects)
    res.status(201).json({
      message: "Signup successful",
      data: { user: data.user, session: data.session },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(400).json({ error: "Signup failed" });
  }
};

export const login = async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid email or password" });
  }
  const { email, password } = parsed.data;

  try {
    const authClient = createAuthClient();

    // 1. Authenticate (throwaway client — no shared session)
    const { data: authData, error: authError } =
      await authClient.auth.signInWithPassword({ email, password });

    // Generic message — never reveal whether the email exists.
    if (authError) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const authUser = authData.user;

    // 2. Fetch latest profile from public.users
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("full_name, company_name, role, profile_image")
      .eq("id", authUser.id)
      .single();

    if (profileError && profileError.code !== "PGRST116") throw profileError; // ignore "no rows"

    // 3. Merge: auth user + fresh profile
    const mergedUser = {
      ...authUser,
      full_name: profile?.full_name || "",
      company_name:
        profile?.company_name || authUser.user_metadata?.company_name || "",
      role: profile?.role || "user",
      profile_image: profile?.profile_image || "",
    };

    // 4. Return merged user + session (frontend saves access_token AND refresh_token)
    res.status(200).json({
      message: "Login successful",
      data: { user: mergedUser, session: authData.session },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
};

// POST /api/auth/refresh — exchanges a refresh_token for a new session.
export const refresh = async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) {
    return res.status(400).json({ error: "refresh_token is required" });
  }

  try {
    const authClient = createAuthClient();
    const { data, error } = await authClient.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      return res.status(401).json({ error: "Session expired, please log in" });
    }

    res.json({ data: { session: data.session, user: data.user } });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(401).json({ error: "Session expired, please log in" });
  }
};
