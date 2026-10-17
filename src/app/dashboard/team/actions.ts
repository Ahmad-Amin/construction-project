"use server";

import { revalidatePath } from "next/cache";
import { getOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export type TeamResult = { error?: string; link?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC = "Something went wrong. Please try again.";

// Our database raises plain-English messages (error code P0001) for things like "your plan is full"; show those as they are.
const friendly = (error: { code?: string; message: string }) => (error.code === "P0001" ? error.message : GENERIC);

const cleanIds = (list: unknown): string[] =>
  Array.isArray(list) ? [...new Set(list.filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(0, 200) : [];

// Access is two lists: the projects a person can open, and, within those, the ones where they also see payments.
function parseAccess(projectIds: unknown, paymentIds: unknown) {
  const projects = cleanIds(projectIds);
  return { projects, payments: cleanIds(paymentIds).filter((id) => projects.includes(id)) };
}

const linkFor = async (token: string) => `${await getOrigin()}/invite/team/${token}`;
const refresh = () => revalidatePath("/dashboard/team");

export async function inviteStaff(input: {
  name: string;
  email: string;
  projectIds: string[];
  paymentProjectIds: string[];
}): Promise<TeamResult> {
  const name = String(input?.name ?? "").trim();
  const email = String(input?.email ?? "").trim();
  if (!name) return { error: "Please enter the person's name." };
  if (!email) return { error: "Please enter their email address." };
  const access = parseAccess(input.projectIds, input.paymentProjectIds);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_staff", {
    p_name: name,
    p_email: email,
    p_projects: access.projects,
    p_payment_projects: access.payments,
  });
  if (error || typeof data !== "string") return { error: error ? friendly(error) : GENERIC };

  refresh();
  return { link: await linkFor(data) };
}

// The link of an invitation that is still open, to copy or send again.
export async function getInviteLink(inviteId: string): Promise<TeamResult> {
  if (!UUID.test(inviteId)) return { error: GENERIC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_staff_invite_token", { p_invite: inviteId });
  if (error) return { error: friendly(error) };
  if (typeof data !== "string") return { error: "This invitation has expired. Send a new link instead." };
  return { link: await linkFor(data) };
}

// A fresh link and another 14 days; the old link stops working.
export async function resendInvite(inviteId: string): Promise<TeamResult> {
  if (!UUID.test(inviteId)) return { error: GENERIC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resend_staff_invite", { p_invite: inviteId });
  if (error || typeof data !== "string") return { error: error ? friendly(error) : GENERIC };
  refresh();
  return { link: await linkFor(data) };
}

export async function revokeInvite(inviteId: string): Promise<TeamResult> {
  if (!UUID.test(inviteId)) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_staff_invite", { p_invite: inviteId });
  if (error) return { error: friendly(error) };
  refresh();
  return {};
}

export async function saveStaffAccess(userId: string, projectIds: string[], paymentProjectIds: string[]): Promise<TeamResult> {
  if (!UUID.test(userId)) return { error: GENERIC };
  const access = parseAccess(projectIds, paymentProjectIds);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_access", {
    p_user: userId,
    p_projects: access.projects,
    p_payment_projects: access.payments,
  });
  if (error) return { error: friendly(error) };
  refresh();
  // What staff see in their sidebar and project pages depends on this.
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function removeStaff(userId: string): Promise<TeamResult> {
  if (!UUID.test(userId)) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_staff", { p_user: userId });
  if (error) return { error: friendly(error) };
  refresh();
  return {};
}
