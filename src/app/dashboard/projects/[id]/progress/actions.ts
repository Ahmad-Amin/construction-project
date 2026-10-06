"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

const GENERIC = "Something went wrong. Please try again.";

// Our database functions raise plain-English messages (error code P0001); show those as-is.
const friendly = (error: { code?: string; message: string }) =>
  error.code === "P0001" ? error.message : GENERIC;

// Refresh everything that shows milestone data.
function refresh(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
  revalidatePath("/dashboard");
}

export async function setProgress(
  projectId: string,
  milestoneId: string,
  percent: number,
): Promise<ActionResult> {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    return { error: "Progress must be between 0 and 100." };
  }
  const supabase = await createClient();
  // RLS ignores updates you aren't allowed to make, so check a row came back.
  const { data, error } = await supabase
    .from("milestones")
    .update({ progress_percent: percent })
    .eq("id", milestoneId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "You can't update this milestone." };
  refresh(projectId);
  return {};
}

export async function addMilestone(projectId: string, name: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_milestone", { p_project_id: projectId, p_name: name });
  if (error) return { error: friendly(error) };
  refresh(projectId);
  return {};
}

export async function renameMilestone(
  projectId: string,
  milestoneId: string,
  name: string,
): Promise<ActionResult> {
  if (!name.trim()) return { error: "A milestone needs a name." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .update({ name })
    .eq("id", milestoneId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "You can't rename this milestone." };
  refresh(projectId);
  return {};
}

export async function moveMilestone(
  projectId: string,
  milestoneId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_milestone", {
    p_milestone_id: milestoneId,
    p_direction: direction,
  });
  if (error) return { error: friendly(error) };
  refresh(projectId);
  return {};
}

export async function removeMilestone(
  projectId: string,
  milestoneId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: friendly(error) };
  if (!data?.length) return { error: "Only the company owner can delete milestones." };
  refresh(projectId);
  return {};
}
