"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

const GENERIC = "Something went wrong posting your update. Please try again.";

type NewUpdate = {
  id: string;
  projectId: string;
  date: string;
  text: string;
  milestoneId: string | null;
  progress: number | null;
  photos: { path: string; thumb: string | null }[];
};

function refresh(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
  revalidatePath("/dashboard");
}

// Photos are already in storage by the time this runs; this records the update itself.
export async function createUpdate(input: NewUpdate): Promise<ActionResult> {
  const text = input.text.trim();
  if (!text) return { error: "Please write a short update." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_update", {
    p_id: input.id,
    p_project_id: input.projectId,
    p_date: /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null,
    p_text: text,
    p_milestone_id: input.milestoneId,
    p_progress: input.milestoneId ? input.progress : null,
    p_photos: input.photos,
  });
  // Our database function raises plain-English messages (error code P0001).
  if (error) return { error: error.code === "P0001" ? error.message : GENERIC };

  refresh(input.projectId);
  return {};
}

export async function deleteUpdate(projectId: string, updateId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: photos } = await supabase
    .from("project_photos")
    .select("storage_path, thumb_path")
    .eq("update_id", updateId);

  // RLS only lets the author or the owner delete; a blocked delete returns no row.
  const { data, error } = await supabase
    .from("project_updates")
    .delete()
    .eq("id", updateId)
    .eq("project_id", projectId)
    .select("id");
  if (error) return { error: "We couldn't delete that update. Please try again." };
  if (!data?.length) return { error: "Only the author or the company owner can delete this update." };

  const files = (photos ?? []).flatMap((p) =>
    p.thumb_path ? [p.storage_path, p.thumb_path] : [p.storage_path],
  );
  if (files.length > 0) await supabase.storage.from("project-media").remove(files);

  refresh(projectId);
  return {};
}
