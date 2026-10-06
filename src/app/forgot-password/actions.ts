"use server";

import { cookies, headers } from "next/headers";
import type { FormState } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Please enter your email." };

  // The emailed link only works in the browser that asked for it. Remember that this
  // browser wants a reset, so the callback knows to ask for a new password.
  (await cookies()).set("pw_reset", "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback` });

  // The same answer whether or not the email has an account, so nobody can probe for accounts.
  return {
    message: "If that email has an account, we've sent a link to reset your password. Open it on this device.",
  };
}
