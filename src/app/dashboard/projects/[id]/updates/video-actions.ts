"use server";

import { after } from "next/server";
import { createDirectUpload, deleteStreamVideo, playerUrl, signVideoToken, streamConfig, videoUploadsOn } from "@/lib/stream";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MAX_VIDEO_BYTES } from "@/lib/video-rules";
import { refreshVideoStatuses, removeDeletedVideosSoon, toVideoItems, VIDEO_COLUMNS, type VideoItem, type VideoRow } from "@/lib/videos";

// Site videos: the server's part. The database decides who may add and watch (and the plan's limits); Cloudflare holds
// the files. The secret-key client is used only to record what Cloudflare says (its id for an upload, a video's
// status) and to work through the deletion list: never with anything the browser sends.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC = "Something went wrong with the video. Please try again.";
const friendly = (error: { code?: string; message: string }) => (error.code === "P0001" ? error.message : GENERIC);

export type StartResult = { error: string } | { uploadUrl: string; maxSeconds: number };

// Gets a one-time upload link for a video the person is adding to an update they are writing.
export async function startVideoUpload(input: { videoId: string; projectId: string; updateId: string; size: number }): Promise<StartResult> {
  const { videoId, projectId, updateId, size } = input ?? {};
  if (![videoId, projectId, updateId].every((v) => typeof v === "string" && UUID.test(v))) return { error: GENERIC };
  if (!Number.isInteger(size) || size < 1) return { error: GENERIC };
  if (size > MAX_VIDEO_BYTES) return { error: "This file is too big to upload. Please choose a shorter video." };
  const cfg = streamConfig();
  if (!cfg || !videoUploadsOn()) return { error: "Videos aren't switched on right now." };

  const supabase = await createClient();
  const { data: allowed, error } = await supabase.rpc("start_video_upload", { p_id: videoId, p_project: projectId, p_update: updateId });
  if (error) return { error: friendly(error) };
  const maxSeconds = Number(allowed);

  let upload;
  try {
    upload = await createDirectUpload(cfg, { size, maxSeconds, name: videoId });
  } catch (err) {
    console.error("[videos] couldn't start an upload at Cloudflare", err instanceof Error ? err.message : err);
    await supabase.rpc("cancel_video_upload", { p_id: videoId });
    return { error: "We couldn't start the upload. Please try again in a moment." };
  }

  const admin = createAdminClient();
  const { error: attachError } = await admin.rpc("attach_video_upload", { p_id: videoId, p_uid: upload.uid });
  if (attachError) {
    await supabase.rpc("cancel_video_upload", { p_id: videoId });
    after(() => deleteStreamVideo(cfg, upload.uid).catch(() => {}));
    return { error: GENERIC };
  }
  return { uploadUrl: upload.uploadUrl, maxSeconds };
}

// The person removed a video before posting (or its upload failed): its minutes come back, and it is removed from
// Cloudflare straight after this answers.
export async function cancelVideoUpload(videoId: string): Promise<void> {
  if (typeof videoId !== "string" || !UUID.test(videoId)) return;
  const supabase = await createClient();
  const { data } = await supabase.rpc("cancel_video_upload", { p_id: videoId });
  if (data === true) after(() => removeDeletedVideosSoon(createAdminClient));
}

// Where each of these videos stands (only ones this person may see). Videos still processing are checked with
// Cloudflare directly when its notification hasn't arrived.
export async function videoStatuses(ids: string[]): Promise<VideoItem[]> {
  const wanted = Array.isArray(ids) ? ids.filter((v) => typeof v === "string" && UUID.test(v)).slice(0, 20) : [];
  if (wanted.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("project_videos").select(VIDEO_COLUMNS).in("id", wanted);
  let rows = (data ?? []) as VideoRow[];
  if (rows.some((r) => r.status === "processing" || r.status === "uploading")) {
    rows = await refreshVideoStatuses(createAdminClient(), rows);
  }
  return toVideoItems(rows);
}

export type PlayerResult = { error: string } | { src: string };

// A fresh, private player link for one video this person may watch.
export async function videoPlayer(videoId: string): Promise<PlayerResult> {
  if (typeof videoId !== "string" || !UUID.test(videoId)) return { error: "This video isn't available." };
  const cfg = streamConfig();
  if (!cfg) return { error: "Videos aren't available right now." };
  const supabase = await createClient();
  const { data } = await supabase.from("project_videos").select("provider_uid, status").eq("id", videoId).maybeSingle();
  if (!data?.provider_uid) return { error: "This video isn't available." };
  if (data.status !== "ready") return { error: "This video is still being prepared. Try again in a moment." };
  // Two hours: plenty for a video of a few minutes, paused and replayed.
  return { src: playerUrl(cfg, signVideoToken(cfg, data.provider_uid, 2 * 60 * 60)) };
}
