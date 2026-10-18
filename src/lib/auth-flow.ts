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

// Links to /auth/confirm carry a one-time token (token_hash) and its type. The reminder to confirm an email uses a
// "recovery" token: opening it confirms an unconfirmed email and signs the person in. Unlike a "magiclink" one, it can
// never create an account for an address that has none. "email" and "signup" are what Supabase's own confirmation
// emails use, should their templates point here.
export const CONFIRM_LINK_TYPES = ["recovery", "email", "signup"] as const;
export type ConfirmLinkType = (typeof CONFIRM_LINK_TYPES)[number];

// The token and type of a confirm link, or null when the link is incomplete or not one of ours.
export function confirmLinkFrom(tokenHash: unknown, type: unknown): { tokenHash: string; type: ConfirmLinkType } | null {
  if (typeof tokenHash !== "string" || !/^[\w-]{16,200}$/.test(tokenHash)) return null;
  if (typeof type !== "string" || !(CONFIRM_LINK_TYPES as readonly string[]).includes(type)) return null;
  return { tokenHash, type: type as ConfirmLinkType };
}
