"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { queueNotificationDelivery } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MAX_VIDEOS_PER_UPDATE } from "@/lib/video-rules";
import { removeDeletedVideosSoon } from "@/lib/videos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // Videos already uploaded to Cloudflare for this update (from startVideoUpload).
  videos?: string[];
};

function refresh(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
  revalidatePath("/dashboard");
}

// Photos are already in storage, and videos at Cloudflare, by the time this runs; this records the update itself.
export async function createUpdate(input: NewUpdate): Promise<ActionResult> {
  const text = input.text.trim();
  if (!text) return { error: "Please write a short update." };
  const videos = Array.isArray(input.videos) ? input.videos.filter((v) => typeof v === "string" && UUID.test(v)) : [];
  if (videos.length > MAX_VIDEOS_PER_UPDATE) return { error: `You can add up to ${MAX_VIDEOS_PER_UPDATE} videos to one update.` };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_update", {
    p_id: input.id,
    p_project_id: input.projectId,
    p_date: /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null,
    p_text: text,
    p_milestone_id: input.milestoneId,
    p_progress: input.milestoneId ? input.progress : null,
    p_photos: input.photos,
    p_videos: videos,
  });
  // Our database function raises plain-English messages (error code P0001).
  if (error) return { error: error.code === "P0001" ? error.message : GENERIC };

  refresh(input.projectId);
  queueNotificationDelivery();
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
  // Its videos were queued for removal when the update went; remove them from Cloudflare after answering.
  after(() => removeDeletedVideosSoon(createAdminClient));

  refresh(projectId);
  return {};
}
