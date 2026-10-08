import { createClient } from "@supabase/supabase-js";

// A client that bypasses row-level security. Only for scheduled jobs that have no signed-in
// person (the weekly summary). Never import it into a page or an action a user can trigger,
// and never expose the key to the browser.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
