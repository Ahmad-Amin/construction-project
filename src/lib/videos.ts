import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteStreamVideo,
  fetchVideoState,
  signVideoToken,
  streamConfig,
  thumbnailUrl,
  type StreamConfig,
} from "@/lib/stream";

// Site videos as the screens show them. Server only (it signs links); the types are shared with the browser.

export type VideoStatus = "processing" | "ready" | "error" | "unavailable";

export type VideoItem = {
  id: string;
  status: VideoStatus;
  // Seconds, once Cloudflare knows.
  duration: number | null;
  // A signed still from the video (ready videos only).
  thumb: string | null;
  // Why it failed, in plain words (failed videos only).
  problem: string | null;
};

export type VideoRow = {
  id: string;
  provider_uid: string | null;
  status: "uploading" | "processing" | "ready" | "error";
  duration_seconds: number | string | null;
  error_code: string;
  created_at: string;
  checked_at: string | null;
};

export const VIDEO_COLUMNS = "id, provider_uid, status, duration_seconds, error_code, created_at, checked_at";

// Thumbnails stay valid for a working day, so a page left open keeps its pictures.
const THUMB_SECONDS = 8 * 60 * 60;

export function videoProblem(code: string) {
  if (/DURATION/i.test(code)) return "This video was longer than your plan allows.";
  if (code === "NEVER_READY") return "This video didn't finish uploading.";
  return "This video couldn't be processed.";
}

export function toVideoItem(row: VideoRow, cfg: StreamConfig | null, now = Date.now()): VideoItem {
  const duration = row.duration_seconds === null ? null : Number(row.duration_seconds);
  if (row.status === "error") return { id: row.id, status: "error", duration, thumb: null, problem: videoProblem(row.error_code) };
  if (row.status !== "ready") return { id: row.id, status: "processing", duration, thumb: null, problem: null };
  if (!cfg || !row.provider_uid) return { id: row.id, status: "unavailable", duration, thumb: null, problem: null };
  return { id: row.id, status: "ready", duration, thumb: thumbnailUrl(cfg, signVideoToken(cfg, row.provider_uid, THUMB_SECONDS, now)), problem: null };
}

export function toVideoItems(rows: VideoRow[]): VideoItem[] {
  if (rows.length === 0) return [];
  const cfg = streamConfig();
  const now = Date.now();
  return rows.map((r) => toVideoItem(r, cfg, now));
}

// The address videos are delivered from, to open a connection early (null when videos are off).
export function videoOrigin() {
  return streamConfig()?.deliveryBase ?? null;
}

// ---------------------------------------------------------------------------
// Asking Cloudflare directly, for videos still processing (in case its notification was lost or hasn't come yet)
// ---------------------------------------------------------------------------
// `admin` is the secret-key client: only the server may record what Cloudflare says. Each video is asked about at
// most every 15 seconds, however often the page checks.
export async function refreshVideoStatuses(admin: SupabaseClient, rows: VideoRow[], now = Date.now()) {
  const cfg = streamConfig();
  if (!cfg) return rows;
  const due = rows.filter(
    (r) =>
      r.provider_uid &&
      (r.status === "processing" || r.status === "uploading") &&
      now - Date.parse(r.created_at) > 10_000 &&
      (!r.checked_at || now - Date.parse(r.checked_at) > 15_000),
  );
  if (due.length === 0) return rows;
  const updated = new Map<string, VideoRow>();
  await Promise.all(
    due.map(async (r) => {
      try {
        const state = await fetchVideoState(cfg, r.provider_uid!);
        // A video Cloudflare no longer has can't become ready.
        const s = state ?? { state: "error", duration: null, errorCode: "NOT_FOUND" };
        await admin.rpc("video_set_status", { p_uid: r.provider_uid, p_state: s.state, p_duration: s.duration, p_error: s.errorCode });
        const next: VideoRow = { ...r, checked_at: new Date(now).toISOString() };
        if (r.status === "uploading" && ["downloading", "queued", "inprogress"].includes(s.state)) next.status = "processing";
        if (s.state === "ready") Object.assign(next, { status: "ready", duration_seconds: s.duration ?? r.duration_seconds });
        if (s.state === "error") Object.assign(next, { status: "error", error_code: s.errorCode });
        updated.set(r.id, next);
      } catch (err) {
        console.error("[videos] couldn't check a video at Cloudflare", r.id, err instanceof Error ? err.message : err);
      }
    }),
  );
  return rows.map((r) => updated.get(r.id) ?? r);
}

// ---------------------------------------------------------------------------
// Removing deleted videos from Cloudflare (after a delete, and in the daily job)
// ---------------------------------------------------------------------------
// After answering a delete: never lets a problem reach the person (the daily job tries again).
export async function removeDeletedVideosSoon(makeAdmin: () => SupabaseClient) {
  try {
    if (!streamConfig()) return;
    await processVideoDeletions(makeAdmin(), 10);
  } catch (err) {
    console.error("[videos] couldn't remove deleted videos yet; the daily job will", err instanceof Error ? err.message : err);
  }
}

export async function processVideoDeletions(admin: SupabaseClient, limit = 25) {
  const cfg = streamConfig();
  if (!cfg) return { removed: 0, failed: 0 };
  const { data, error } = await admin.rpc("video_deletions_due", { p_limit: limit });
  if (error) {
    console.error("[videos] couldn't read the deletion list", error.message);
    return { removed: 0, failed: 0 };
  }
  let removed = 0;
  let failed = 0;
  for (const { provider_uid: uid } of (data ?? []) as { provider_uid: string }[]) {
    try {
      await deleteStreamVideo(cfg, uid);
      await admin.rpc("video_deletion_done", { p_uid: uid, p_error: null });
      removed++;
    } catch (err) {
      failed++;
      await admin.rpc("video_deletion_done", { p_uid: uid, p_error: err instanceof Error ? err.message : "failed" });
    }
  }
  return { removed, failed };
}

// The daily job: drop videos that were never posted (and their minutes), mark ones that never became ready as
// failed, then remove what is waiting at Cloudflare.
export async function cleanUpVideos(admin: SupabaseClient) {
  const { data, error } = await admin.rpc("clean_up_videos");
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as { removed: number; failed: number }[])[0] ?? { removed: 0, failed: 0 };
  const deletions = await processVideoDeletions(admin, 100);
  return { dropped: row.removed, markedFailed: row.failed, removedAtCloudflare: deletions.removed, deletionFailures: deletions.failed };
}
