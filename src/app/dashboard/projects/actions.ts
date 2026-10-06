"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/login/actions";
import { dateOrNull, parseAmount, snapshot, text } from "@/lib/forms";
import { queueEmailDelivery } from "@/lib/notifications";
import { removeProjectFiles } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Something went wrong saving this project. Please try again.";

// Our database functions raise plain-English messages (error code P0001); show those as-is.
const friendly = (error: { code?: string; message: string }) =>
  error.code === "P0001" ? error.message : GENERIC_ERROR;

const fail = (formData: FormData, error: string): FormState => ({
  error,
  values: snapshot(formData),
});

export async function createProject(_: FormState, formData: FormData): Promise<FormState> {
  const budget = parseAmount(text(formData, "budget"));
  if (budget.error) return fail(formData, budget.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_project", {
    p_name: text(formData, "name"),
    p_location: text(formData, "location"),
    p_start_date: dateOrNull(text(formData, "start_date")),
    p_expected_completion_date: dateOrNull(text(formData, "expected_completion_date")),
    p_budget: budget.value,
    p_client_name: text(formData, "client_name"),
    p_client_email: text(formData, "client_email"),
    p_client_phone: text(formData, "client_phone"),
    p_milestones: formData.getAll("milestone").map((m) => String(m).trim()).filter(Boolean),
  });

  if (error || !data) return fail(formData, error ? friendly(error) : GENERIC_ERROR);
  // The side navigation lists projects, so it has to reload to include this one.
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/projects/${data}`);
}

const STATUSES = ["active", "on_hold", "completed"];

export async function updateProject(
  id: string,
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = text(formData, "name");
  if (!name) return fail(formData, "Please enter a project name.");
  const clientName = text(formData, "client_name");
  if (!clientName) return fail(formData, "Please enter the client's name.");

  const budget = parseAmount(text(formData, "budget"));
  if (budget.error) return fail(formData, budget.error);

  const status = text(formData, "status");
  if (!STATUSES.includes(status)) return fail(formData, "Please choose a valid status.");

  const supabase = await createClient();

  // RLS silently ignores updates the user isn't allowed to make, so check a row came back.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .update({
      name,
      location: text(formData, "location"),
      start_date: dateOrNull(text(formData, "start_date")),
      expected_completion_date: dateOrNull(text(formData, "expected_completion_date")),
      status,
    })
    .eq("id", id)
    .select("client_id")
    .maybeSingle();
  if (projectError) return fail(formData, GENERIC_ERROR);
  if (!project) return fail(formData, "Only the company owner can edit this project.");

  const clientUpdate: { name: string; phone: string | null; email?: string } = {
    name: clientName,
    phone: text(formData, "client_phone") || null,
  };
  // The email field is disabled (and not submitted) once the client has signed in.
  const email = text(formData, "client_email");
  if (email) clientUpdate.email = email;

  const { error: clientError } = await supabase
    .from("clients")
    .update(clientUpdate)
    .eq("id", project.client_id);
  if (clientError) return fail(formData, friendly(clientError));

  if (budget.value === null) {
    await supabase.from("project_budgets").delete().eq("project_id", id);
  } else {
    const { error: budgetError } = await supabase.from("project_budgets").upsert({
      project_id: id,
      amount: budget.value,
      visible_to_client: formData.get("budget_visible") === "on",
    });
    if (budgetError) return fail(formData, GENERIC_ERROR);
  }

  // The name and status also show in the side navigation.
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/projects/${id}`);
}

// Archive hides a project from the owner's lists and dashboard totals. Nothing is lost.
export async function archiveProject(projectId: string, archived: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  // Row-level security ignores updates you aren't allowed to make, so check a row came back.
  const { data, error } = await supabase
    .from("projects")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", projectId)
    .select("id");
  if (error) return { error: GENERIC_ERROR };
  if (!data?.length) return { error: "Only the company owner can archive a project." };

  revalidatePath("/dashboard", "layout");
  return {};
}

// Permanent. The person must type the project's name, and the database refuses when the
// project has confirmed payments.
export async function deleteProject(projectId: string, typedName: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("name").eq("id", projectId).maybeSingle();
  if (!project) return { error: "We couldn't find that project." };
  if (typedName.trim() !== project.name.trim()) {
    return { error: "The name you typed doesn't match. Please type the project name exactly." };
  }

  // Ask first, so we never remove the photos of a project the database then refuses to delete.
  const { data: blocker } = await supabase.rpc("delete_project_blocker", { p_project_id: projectId });
  if (blocker) return { error: blocker as string };

  await removeProjectFiles(supabase, projectId);

  const { error } = await supabase.rpc("delete_project", { p_project_id: projectId });
  if (error) return { error: friendly(error) };

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard?deleted=${encodeURIComponent(project.name)}`);
}

// Mark a project complete (the client is told) or reopen it.
export async function setProjectStatus(
  projectId: string,
  status: "active" | "on_hold" | "completed",
): Promise<{ error?: string }> {
  if (!STATUSES.includes(status)) return { error: "Please choose a valid status." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId)
    .select("id");
  if (error) return { error: GENERIC_ERROR };
  if (!data?.length) return { error: "Only the company owner can change a project's status." };

  revalidatePath("/dashboard", "layout");
  queueEmailDelivery();
  return {};
}
