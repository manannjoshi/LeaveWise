import { createClient } from "@supabase/supabase-js";

// This elevated client is server-only; never import it into a client component.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase server environment variables are missing.");

  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
