import type { User } from "@supabase/supabase-js";

// "Continue with Google" is shown only when NEXT_PUBLIC_GOOGLE_AUTH=on. Turn it on after the Google provider is
// switched on in Supabase (Authentication > Providers), so nobody clicks a button that can't work yet.
export const GOOGLE_AUTH_ENABLED = (process.env.NEXT_PUBLIC_GOOGLE_AUTH ?? "").trim().toLowerCase() === "on";

// Whether this is the very first time someone signs in with Google, which is when their account was just created.
// (A later Google sign-in, or an old account that was only linked to Google, is not a new sign-up.) For a brand-new
// account Supabase stamps the creation and the first sign-in at the same moment.
export function isFirstGoogleSignIn(user: Pick<User, "app_metadata" | "created_at" | "last_sign_in_at"> | null | undefined) {
  if (!user || user.app_metadata?.provider !== "google" || !user.last_sign_in_at) return false;
  const created = Date.parse(user.created_at);
  const lastSignIn = Date.parse(user.last_sign_in_at);
  if (Number.isNaN(created) || Number.isNaN(lastSignIn)) return false;
  return Math.abs(lastSignIn - created) < 15_000;
}
