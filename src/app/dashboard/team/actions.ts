"use server";

import { revalidatePath } from "next/cache";
import { getOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";
import type { StaffSettings } from "@/lib/team";

export type TeamResult = { error?: string; link?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC = "Something went wrong. Please try again.";

// Our database raises plain-English messages (error code P0001) for things like "your plan is full"; show those as they are.
const friendly = (error: { code?: string; message: string }) => (error.code === "P0001" ? error.message : GENERIC);

const cleanIds = (list: unknown): string[] =>
  Array.isArray(list) ? [...new Set(list.filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(0, 200) : [];

// Access is three lists: the projects a person can open; within those, the ones where they also see payments; and
// within those, the ones where they can invoice.
function parseAccess(projectIds: unknown, paymentIds: unknown, invoiceIds: unknown) {
  const projects = cleanIds(projectIds);
  const payments = cleanIds(paymentIds).filter((id) => projects.includes(id));
  return { projects, payments, invoices: cleanIds(invoiceIds).filter((id) => payments.includes(id)) };
}

const parseSettings = (s: Partial<StaffSettings> | undefined): StaffSettings => ({
  viewOnly: s?.viewOnly === true,
  canSeeBudget: s?.canSeeBudget === true,
  canSeeClient: s?.canSeeClient !== false,
  canSeeLeads: s?.canSeeLeads === true,
});

const linkFor = async (token: string) => `${await getOrigin()}/invite/team/${token}`;
const refresh = () => revalidatePath("/dashboard/team");

export async function inviteStaff(input: {
  name: string;
  email: string;
  projectIds: string[];
  paymentProjectIds: string[];
  invoiceProjectIds: string[];
  settings: StaffSettings;
}): Promise<TeamResult> {
  const name = String(input?.name ?? "").trim();
  const email = String(input?.email ?? "").trim();
  if (!name) return { error: "Please enter the person's name." };
  if (!email) return { error: "Please enter their email address." };
  const access = parseAccess(input.projectIds, input.paymentProjectIds, input.invoiceProjectIds);
  const settings = parseSettings(input.settings);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_staff", {
    p_name: name,
    p_email: email,
    p_projects: access.projects,
    p_payment_projects: access.payments,
    p_invoice_projects: access.invoices,
    p_view_only: settings.viewOnly,
    p_can_see_budget: settings.canSeeBudget,
    p_can_see_client: settings.canSeeClient,
    p_can_see_leads: settings.canSeeLeads,
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

// What a staff member can do: the person-wide settings, then the projects.
export async function saveStaff(
  userId: string,
  settingsInput: StaffSettings,
  projectIds: string[],
  paymentProjectIds: string[],
  invoiceProjectIds: string[],
): Promise<TeamResult> {
  if (!UUID.test(userId)) return { error: GENERIC };
  const access = parseAccess(projectIds, paymentProjectIds, invoiceProjectIds);
  const settings = parseSettings(settingsInput);
  const supabase = await createClient();
  const { error: settingsError } = await supabase.rpc("set_staff_settings", {
    p_user: userId,
    p_view_only: settings.viewOnly,
    p_can_see_budget: settings.canSeeBudget,
    p_can_see_client: settings.canSeeClient,
    p_paused: null,
    p_can_see_leads: settings.canSeeLeads,
  });
  if (settingsError) return { error: friendly(settingsError) };
  const { error } = await supabase.rpc("set_staff_access", {
    p_user: userId,
    p_projects: access.projects,
    p_payment_projects: access.payments,
    p_invoice_projects: access.invoices,
  });
  if (error) return { error: friendly(error) };
  refresh();
  // What staff see in their sidebar and project pages depends on this.
  revalidatePath("/dashboard", "layout");
  return {};
}

// Pause: they see and do nothing until resumed. Nothing of theirs is removed.
export async function setStaffPaused(userId: string, paused: boolean): Promise<TeamResult> {
  if (!UUID.test(userId) || typeof paused !== "boolean") return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_settings", {
    p_user: userId,
    p_view_only: null,
    p_can_see_budget: null,
    p_can_see_client: null,
    p_paused: paused,
  });
  if (error) return { error: friendly(error) };
  refresh();
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
