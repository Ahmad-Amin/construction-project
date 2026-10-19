import { createClient } from "@supabase/supabase-js";

// A client that bypasses row-level security. For scheduled jobs that have no signed-in person (the
// weekly summary, the daily job), for notifications from other services (Cloudflare, WhatsApp), and in
// the video actions only to record what Cloudflare reports and to work through the deletion list.
// Never use it with data a user sends, and never expose the key to the browser.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
