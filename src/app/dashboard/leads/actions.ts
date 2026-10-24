"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/login/actions";
import { flash } from "@/lib/flash";
import { dateOrNull, parseAmount, snapshot, text } from "@/lib/forms";
import { isLeadSource, isLostReason, isStageColor, isWorkType, leadAccess, UUID } from "@/lib/leads";
import { parsePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

// Everything here runs as the signed-in person: the database decides who may see, change or delete a lead, and these
// only turn its answers into plain words.

export type LeadResult = { error?: string };

const GENERIC = "Something went wrong saving this lead. Please try again.";
const NOT_ALLOWED = "You can't change leads. Ask the company owner.";

// Our database raises plain-English messages (error code P0001); show those as they are.
const friendly = (error: { code?: string; message: string }) => (error.code === "P0001" ? error.message : GENERIC);

const fail = (formData: FormData, error: string): FormState => ({ error, values: snapshot(formData) });

function refresh() {
  revalidatePath("/dashboard/leads", "layout");
  // The sidebar shows how many follow-ups are due.
  revalidatePath("/dashboard", "layout");
}

type LeadFields = {
  name: string;
  phone: string | null;
  email: string | null;
  location: string;
  work_type: string;
  size: string;
  budget: number | null;
  source: string;
  notes: string;
  stage_id: string;
};

function readLead(formData: FormData): { ok: false; error: string } | { ok: true; value: LeadFields } {
  const name = text(formData, "name");
  if (!name) return { ok: false, error: "Please enter the lead's name." };
  if (name.length > 120) return { ok: false, error: "Please keep the name to 120 characters." };
  const phone = parsePhone(text(formData, "phone"));
  if (phone.error) return { ok: false, error: phone.error };
  const email = text(formData, "email").toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Please enter a valid email address, or leave it blank." };
  const budget = parseAmount(text(formData, "budget"), "the budget");
  if (budget.error) return { ok: false, error: budget.error };
  const workType = text(formData, "work_type");
  const source = text(formData, "source");
  const stage = text(formData, "stage_id");
  if (!UUID.test(stage)) return { ok: false, error: "Please choose a stage." };
  const location = text(formData, "location");
  const size = text(formData, "size");
  const notes = text(formData, "notes");
  if (location.length > 200) return { ok: false, error: "Please keep the location to 200 characters." };
  if (size.length > 60) return { ok: false, error: "Please keep the size to 60 characters." };
  if (notes.length > 2000) return { ok: false, error: "Please keep the notes to 2,000 characters." };
  return {
    ok: true,
    value: {
      name,
      phone: phone.value,
      email: email || null,
      location,
      work_type: isWorkType(workType) ? workType : "",
      size,
      budget: budget.value,
      source: isLeadSource(source) ? source : "",
      notes,
      stage_id: stage,
    },
  };
}

export async function createLead(_: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer?.company || !leadAccess(viewer).change) return fail(formData, NOT_ALLOWED);
  const parsed = readLead(formData);
  if (!parsed.ok) return fail(formData, parsed.error);
  const followUpOn = dateOrNull(text(formData, "follow_up_on"));
  const followUpNote = text(formData, "follow_up_note").slice(0, 200);

  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    company_id: viewer.company.id,
    ...parsed.value,
    follow_up_on: followUpOn,
    follow_up_note: followUpOn ? followUpNote : "",
  });
  if (error) return fail(formData, error.code === "42501" ? NOT_ALLOWED : friendly(error));

  refresh();
  await flash("Lead added");
  redirect("/dashboard/leads");
}

export async function updateLead(leadId: string, _: FormState, formData: FormData): Promise<FormState> {
  if (!UUID.test(leadId)) return fail(formData, GENERIC);
  const parsed = readLead(formData);
  if (!parsed.ok) return fail(formData, parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").update(parsed.value).eq("id", leadId).select("id");
  if (error) return fail(formData, friendly(error));
  if (!data?.length) return fail(formData, NOT_ALLOWED);

  // Edited inside the lead's panel: the panel switches back to the lead (no new page, so closing it goes back to the board).
  refresh();
  return { message: "Lead saved" };
}

// One change to a lead from the board or its panel. Nothing changed means the database refused it (not allowed).
async function change(leadId: string, values: Record<string, unknown>): Promise<LeadResult> {
  if (!UUID.test(leadId)) return { error: GENERIC };
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").update(values).eq("id", leadId).select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: NOT_ALLOWED };
  refresh();
  return {};
}

export async function moveLead(leadId: string, stageId: string): Promise<LeadResult> {
  if (!UUID.test(stageId)) return { error: GENERIC };
  return change(leadId, { stage_id: stageId });
}

// A follow-up day (yyyy-mm-dd) and what to do then, or null to clear it.
export async function setFollowUp(leadId: string, day: string | null, note: string): Promise<LeadResult> {
  const on = day === null ? null : dateOrNull(day);
  if (day !== null && !on) return { error: "Please choose a date." };
  const cleanNote = String(note ?? "").trim();
  if (cleanNote.length > 200) return { error: "Please keep the note to 200 characters." };
  return change(leadId, { follow_up_on: on, follow_up_note: on ? cleanNote : "" });
}

export async function markLeadWon(leadId: string): Promise<LeadResult> {
  return change(leadId, { status: "won", lost_reason: null });
}

export async function markLeadLost(leadId: string, reason: string): Promise<LeadResult> {
  if (!isLostReason(reason)) return { error: "Please choose why the lead was lost." };
  return change(leadId, { status: "lost", lost_reason: reason });
}

export async function reopenLead(leadId: string): Promise<LeadResult> {
  return change(leadId, { status: "open", lost_reason: null });
}

export async function addLeadNote(leadId: string, body: string): Promise<LeadResult> {
  if (!UUID.test(leadId)) return { error: GENERIC };
  const clean = String(body ?? "").trim();
  if (!clean) return { error: "Please write the note first." };
  if (clean.length > 2000) return { error: "Please keep the note to 2,000 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_lead_note", { p_lead: leadId, p_body: clean });
  if (error) return { error: friendly(error) };
  refresh();
  return {};
}

export async function deleteLead(leadId: string): Promise<LeadResult> {
  if (!UUID.test(leadId)) return { error: GENERIC };
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").delete().eq("id", leadId).select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "Only the company owner can delete a lead." };
  refresh();
  await flash("Lead deleted");
  return {};
}

// ---------------------------------------------------------------------------
// The stages (the owner, from Settings)
// ---------------------------------------------------------------------------
async function stageCall(fn: string, args: Record<string, unknown>): Promise<LeadResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.code === "P0001" ? error.message : "Something went wrong changing the stages. Please try again." };
  refresh();
  revalidatePath("/dashboard/settings");
  return {};
}

export async function addLeadStage(name: string): Promise<LeadResult> {
  return stageCall("add_lead_stage", { p_name: String(name ?? "") });
}

export async function renameLeadStage(stageId: string, name: string): Promise<LeadResult> {
  if (!UUID.test(stageId)) return { error: GENERIC };
  return stageCall("rename_lead_stage", { p_stage: stageId, p_name: String(name ?? "") });
}

export async function reorderLeadStages(stageIds: string[]): Promise<LeadResult> {
  if (!Array.isArray(stageIds) || stageIds.length > 50 || !stageIds.every((id) => typeof id === "string" && UUID.test(id))) return { error: GENERIC };
  return stageCall("set_lead_stage_order", { p_stages: stageIds });
}

export async function setLeadStageColor(stageId: string, color: string): Promise<LeadResult> {
  if (!UUID.test(stageId) || !isStageColor(color)) return { error: "Please choose one of the colours." };
  return stageCall("set_lead_stage_color", { p_stage: stageId, p_color: color });
}

export async function removeLeadStage(stageId: string, moveTo: string | null): Promise<LeadResult> {
  if (!UUID.test(stageId) || (moveTo !== null && !UUID.test(moveTo))) return { error: GENERIC };
  return stageCall("remove_lead_stage", { p_stage: stageId, p_move_to: moveTo });
}

// ---------------------------------------------------------------------------
// The number your own reminders go to on WhatsApp (contractors and staff, from Settings)
// ---------------------------------------------------------------------------
export async function saveReminderWhatsApp(phone: string, reminders: boolean): Promise<LeadResult & { phone?: string | null }> {
  const viewer = await getViewer();
  if (!viewer?.company) return { error: GENERIC };
  const parsed = parsePhone(String(phone ?? ""));
  if (parsed.error) return { error: parsed.error };
  const supabase = await createClient();
  if (!parsed.value) {
    const { error } = await supabase.from("team_whatsapp").delete().eq("user_id", viewer.userId);
    if (error) return { error: "Something went wrong saving your number. Please try again." };
  } else {
    // Change the row if there is one, otherwise add it (the row's owner can't be rewritten, so no upsert).
    const values = { phone: parsed.value, reminders: reminders === true };
    const updated = await supabase.from("team_whatsapp").update(values).eq("user_id", viewer.userId).select("user_id");
    const { error } = updated.error || updated.data?.length ? updated : await supabase.from("team_whatsapp").insert({ user_id: viewer.userId, ...values });
    if (error) return { error: "Something went wrong saving your number. Please try again." };
  }
  revalidatePath("/dashboard/settings");
  return { phone: parsed.value };
}
