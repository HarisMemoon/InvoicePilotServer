import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } =
  process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
}

const serverOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

// Service-role client for DB access — same behaviour as the old single export.
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  serverOptions,
);

// Backward-compat alias: the other controllers import { supabase }.
// Do NOT use this for auth calls (signIn/signUp/refresh).
export const supabase = supabaseAdmin;

// Throwaway anon client for auth calls. Fresh per request, so one user's
// session can never leak into another request's memory.
export const createAuthClient = () => {
  if (!SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_ANON_KEY (needed for auth calls)");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, serverOptions);
};
