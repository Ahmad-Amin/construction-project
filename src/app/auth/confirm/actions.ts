"use server";

import { redirect } from "next/navigation";
import { confirmLinkFrom } from "@/lib/auth-flow";
import { flash } from "@/lib/flash";
import { finishSignIn } from "@/lib/sign-in";
import { PRODUCT_NAME } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type ConfirmState = { error?: string };

const EXPIRED = "This link has expired or was already used. Sign in with your email and password, and if your email still needs confirming we'll send you a new link.";

// The "Confirm my email" button on /auth/confirm. The token is used only here, when the person presses the button, never
// when the page is opened: email security scanners open links before people do, and would use it up.
export async function confirmEmail(_: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const link = confirmLinkFrom(formData.get("token_hash"), formData.get("type"));
  if (!link) return { error: EXPIRED };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
  if (error || !data.user) return { error: EXPIRED };

  // An invitation they started with (homeowner or staff) is accepted now that they have a session.
  await finishSignIn(supabase, data.user);
  await flash(`Your email is confirmed. Welcome to ${PRODUCT_NAME}!`);
  redirect("/dashboard");
}
