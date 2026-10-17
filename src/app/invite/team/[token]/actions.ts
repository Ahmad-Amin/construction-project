"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/app/login/actions";
import { getOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID = "This invitation isn't valid. Please ask the company owner to send it again.";

// Our database raises plain-English messages (error code P0001) when an invitation can't be used; show those as they are.
const friendly = (error: { code?: string; message: string }) => (error.code === "P0001" ? error.message : INVALID);

// New staff member: create their login with the email the owner entered, then join.
export async function acceptStaffInviteWithPassword(token: string, _: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  if (!UUID.test(token)) return { error: INVALID };
  if (password.length < 8) return { error: "Your password needs at least 8 characters." };

  const supabase = await createClient();
  const { data: invites } = await supabase.rpc("get_staff_invite", { p_token: token });
  const invite = invites?.[0];
  if (!invite || invite.status !== "pending") return { error: INVALID };

  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: {
      // The token rides along so the email-confirmation step can still complete joining the team.
      data: { name: invite.staff_name, staff_invite_token: token },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) {
    return { error: "We couldn't create your account. If you already have one, sign in first, then open this link again." };
  }

  // Email confirmation is on: there's no session until they click the emailed link.
  if (!data.session) {
    return { message: "Almost there — check your email to confirm, and you'll join the team." };
  }

  const { error: acceptError } = await supabase.rpc("accept_staff_invite", { p_token: token });
  if (acceptError) return { error: friendly(acceptError) };
  redirect("/dashboard");
}

// Someone who already has a login and is signed in on the invited email.
export async function acceptStaffInviteSignedIn(token: string): Promise<FormState> {
  if (!UUID.test(token)) return { error: INVALID };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_staff_invite", { p_token: token });
  if (error) return { error: friendly(error) };
  redirect("/dashboard");
}
