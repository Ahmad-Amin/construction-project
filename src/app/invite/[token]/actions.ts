"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/login/actions";
import { queueNotificationDelivery } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID = "This invite link isn't valid. Please ask your contractor to send it again.";

// New homeowner: create their login using the email the contractor entered.
export async function acceptInviteWithPassword(
  token: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  if (!UUID.test(token)) return { error: INVALID };
  if (password.length < 8) return { error: "Your password needs at least 8 characters." };

  const supabase = await createClient();
  const { data: invites } = await supabase.rpc("get_invite", { p_token: token });
  const invite = invites?.[0];
  if (!invite) return { error: INVALID };
  if (invite.accepted) {
    return { error: "This invite has already been used. Please sign in instead." };
  }

  const origin = (await headers()).get("origin");
  const { data, error } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: {
      // The token rides along so the email-confirmation step can still claim the invite.
      data: { name: invite.client_name, invite_token: token },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) {
    return {
      error:
        "We couldn't create your account. If you already have one, sign in first, then open this link again.",
    };
  }

  // Email confirmation is on: there's no session until they click the emailed link.
  if (!data.session) {
    return { message: "Almost there — check your email to confirm, and you'll be taken to your project." };
  }

  const { error: acceptError } = await supabase.rpc("accept_invite", { p_token: token });
  if (acceptError) return { error: INVALID };
  queueNotificationDelivery();
  redirect("/dashboard");
}

// Homeowner who already has a login and is signed in on the invited email.
export async function acceptInviteSignedIn(token: string): Promise<FormState> {
  if (!UUID.test(token)) return { error: INVALID };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) {
    return { error: "This invite is for a different email address than the one you're signed in with." };
  }
  queueNotificationDelivery();
  redirect("/dashboard");
}
