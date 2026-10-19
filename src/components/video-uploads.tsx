"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, CheckCircle2, Film, RotateCw, Video, VideoIcon, WifiOff, X } from "lucide-react";
import { Spinner } from "@/components/spinner";
import { button } from "@/lib/ui";
import { useVideoUploadManager, type VideoLimits, type VideoUpload } from "@/components/video-upload-manager";
import { formatClock, formatLength, MAX_VIDEOS_PER_UPDATE } from "@/lib/video-rules";

export type { VideoLimits } from "@/components/video-upload-manager";

// The videos of one update being written, as the Add update form sees them. The uploading itself happens in the
// app-wide upload manager (video-upload-manager.tsx), so it carries on after the update is posted, wherever the person
// goes in BuildPeek.

export type VideoDraft = VideoUpload;

export function useVideoUploads({
  projectId,
  updateId,
  projectName,
  limits,
}: {
  projectId: string;
  updateId: string;
  projectName: string;
  limits: VideoLimits | null;
}) {
  const manager = useVideoUploadManager();
  if (!manager) throw new Error("VideoUploadProvider is missing from the layout.");
  const { uploads, notices, add, remove, retry, markPosted, discard } = manager;
  const items = useMemo(() => uploads.filter((u) => u.updateId === updateId), [uploads, updateId]);

  // Leaving the form without posting removes its videos (and gives their minutes back). A posted update's videos
  // carry on uploading.
  useEffect(() => () => discard(updateId), [discard, updateId]);

  const percent = useMemo(() => {
    const total = items.reduce((s, u) => s + u.size, 0);
    if (total === 0) return 0;
    const sent = items.reduce((s, u) => s + (u.phase === "done" ? u.size : Math.round((u.percent / 100) * u.size)), 0);
    return Math.min(99, Math.floor((sent / total) * 100));
  }, [items]);

  return {
    items,
    notice: notices[updateId] ?? null,
    percent,
    // Still being checked or getting its upload link: the update can't be posted for these few seconds.
    preparing: items.some((u) => u.phase === "checking" || u.phase === "starting" || (u.phase === "paused" && !u.linked)),
    // Still uploading (the update can be posted; the upload carries on).
    uploading: items.some((u) => u.phase === "uploading" || (u.phase === "paused" && u.linked)),
    failed: items.some((u) => u.phase === "failed"),
    // What the update gets when posted: every video that has its upload link.
    postableIds: items.filter((u) => u.linked && u.phase !== "failed").map((u) => u.id),
    add: (files: FileList | null) => {
      if (limits) add(files, { projectId, updateId, projectName, limits });
    },
    remove,
    retry,
    markPosted: () => markPosted(updateId),
  };
}

export type VideoUploads = ReturnType<typeof useVideoUploads>;

const megabytes = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;

// The Videos part of the Add update form.
export function VideoField({
  uploads,
  limits,
  disabled,
  upgradeHref,
}: {
  uploads: VideoUploads;
  // Null: this plan has no videos.
  limits: VideoLimits | null;
  disabled: boolean;
  // Where to see plans (the owner), when this plan has no videos.
  upgradeHref: string | null;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  if (!limits) {
    return (
      <div className="border-t border-line pt-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          Videos <span className="rounded-full bg-primary-soft px-1.5 text-[10px] font-bold uppercase text-primary-hover">Pro</span>
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Short site videos are part of the Pro and Business plans.{" "}
          {upgradeHref && (
            <Link href={upgradeHref} className="font-medium text-foreground underline underline-offset-4">
              See plans
            </Link>
          )}
        </p>
      </div>
    );
  }

  const full = uploads.items.length >= MAX_VIDEOS_PER_UPDATE;
  const none = limits.leftSeconds < 1;

  return (
    <div className="border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-medium">Videos</p>
        <p className="text-xs tabular-nums text-muted">{none ? "No video minutes left this month" : `${formatLength(limits.leftSeconds)} left this month`}</p>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        Up to {MAX_VIDEOS_PER_UPDATE}, each up to {formatClock(limits.maxSeconds)} long. They upload while you write, and you can post
        before they finish.
      </p>

      {uploads.items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {uploads.items.map((v, i) => (
            <VideoDraftTile key={v.id} video={v} index={i} onRemove={() => uploads.remove(v.id)} onRetry={() => uploads.retry(v.id)} />
          ))}
        </ul>
      )}

      {uploads.uploading && (
        <p className="mt-3 text-xs text-muted">
          You can post now. The video keeps uploading while you use BuildPeek; just keep this tab open until it&apos;s done.
        </p>
      )}

      {uploads.notice && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {uploads.notice}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={disabled || full || none} onClick={() => cameraInput.current?.click()} className={button("secondary", "sm")}>
          <VideoIcon className="size-4" aria-hidden /> Record video
        </button>
        <button type="button" disabled={disabled || full || none} onClick={() => galleryInput.current?.click()} className={button("secondary", "sm")}>
          <Film className="size-4" aria-hidden /> Choose video
        </button>
      </div>
      <input
        ref={cameraInput}
        type="file"
        accept="video/*"
        capture="environment"
        hidden
        onChange={(e) => {
          uploads.add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={(e) => {
          uploads.add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function VideoDraftTile({ video: v, index, onRemove, onRetry }: { video: VideoUpload; index: number; onRemove: () => void; onRetry: () => void }) {
  const label =
    v.phase === "checking"
      ? "Checking the video…"
      : v.phase === "starting"
        ? "Getting ready to upload…"
        : v.phase === "uploading"
          ? `Uploading ${v.percent}%`
          : v.phase === "paused"
            ? (v.error ?? "Upload paused")
            : v.phase === "done"
              ? "Uploaded"
              : (v.error ?? "This video couldn't be uploaded.");
  const showBar = v.phase === "uploading" || v.phase === "paused" || v.phase === "done";

  return (
    <li className="overflow-hidden rounded-xl border border-line bg-surface-2/50">
      <div className="flex items-stretch gap-3 p-2">
        <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-stone-900 sm:w-32">
          {v.poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- a picture made on the phone from the video itself
            <img src={v.poster} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-white/70">
              <Video className="size-6" aria-hidden />
            </span>
          )}
          {v.duration !== null && (
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
              {formatClock(v.duration)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <p className="truncate text-sm font-medium" title={v.name}>
            {v.name || `Video ${index + 1}`}
          </p>
          <p
            className={`flex items-center gap-1.5 text-xs ${v.phase === "failed" ? "text-danger" : v.phase === "done" ? "text-success" : v.phase === "paused" ? "text-primary-hover" : "text-muted"}`}
            role={v.phase === "failed" ? "alert" : "status"}
          >
            {v.phase === "checking" || v.phase === "starting" ? <Spinner className="size-3.5" /> : null}
            {v.phase === "done" && <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />}
            {v.phase === "paused" && <WifiOff className="size-3.5 shrink-0" aria-hidden />}
            {v.phase === "failed" && <AlertTriangle className="size-3.5 shrink-0" aria-hidden />}
            <span className="min-w-0">{label}</span>
          </p>
          <p className="whitespace-nowrap text-xs tabular-nums text-muted">{megabytes(v.size)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-1">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove video ${index + 1}`}
            className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
          {v.phase === "paused" && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-data-accent hover:bg-surface-2">
              <RotateCw className="size-3.5" aria-hidden /> Retry
            </button>
          )}
        </div>
      </div>
      {showBar && (
        <div className="h-1 bg-line" aria-hidden>
          <div
            className={`h-full transition-[width] duration-500 ease-out ${v.phase === "done" ? "bg-success" : v.phase === "paused" ? "bg-primary/50" : "bg-primary"}`}
            style={{ width: `${v.phase === "done" ? 100 : v.percent}%` }}
          />
        </div>
      )}
    </li>
  );
}
