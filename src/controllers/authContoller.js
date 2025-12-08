import { supabase } from "../utils/supabaseClient.js";

export const signup = async (req, res) => {
  try {
    const { full_name, email, password, company_name } = req.body;

    // 1. Sign up in auth.users
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, company_name }, // optional metadata
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error("User creation failed");

    // 2. Insert into public.users
    const { error: dbError } = await supabase.from("users").upsert({
      id: data.user.id,
      email: data.user.email,
      full_name,
      company_name: company_name || null,
    });

    if (dbError) {
      console.error("DB Insert Error:", dbError);
      throw dbError;
    }

    // 3. Return session + user
    res.status(201).json({
      message: "Signup successful",
      data: {
        user: data.user,
        session: data.session,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(400).json({
      error: err.message || "Signup failed",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Authenticate
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) throw authError;

    const authUser = authData.user;

    // 2. Fetch latest profile from public.users
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select(
        `
        full_name,
        company_name,
        role,
        profile_image
      `
      )
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

    // 4. Return merged user + session
    res.status(200).json({
      message: "Login successful",
      data: {
        user: mergedUser,
        session: authData.session,
      },
    });

    console.log("Merged user:", mergedUser);
  } catch (err) {
    console.error("Login error:", err);
    res.status(400).json({ error: err.message });
  }
};
