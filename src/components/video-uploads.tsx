"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Film, RotateCw, Video, VideoIcon, WifiOff, X } from "lucide-react";
import type { Upload as TusUpload } from "tus-js-client";
import { cancelVideoUpload, startVideoUpload, type StartResult } from "@/app/dashboard/projects/[id]/updates/video-actions";
import { Spinner } from "@/components/spinner";
import { newId } from "@/lib/ids";
import { button } from "@/lib/ui";
import { probeVideo } from "@/lib/video-probe";
import {
  formatClock,
  formatLength,
  isVideoFile,
  MAX_VIDEO_BYTES,
  MAX_VIDEOS_PER_UPDATE,
  VIDEO_CHUNK_BYTES,
  videoLengthProblem,
} from "@/lib/video-rules";

// Videos added to an update while it is being written. Each one, as soon as it is picked:
//   1. the phone reads its length (a video that is too long is refused here, before any data is used),
//   2. the server gets a one-time upload link (and checks the plan, the 2 per update and the month's minutes),
//   3. the file goes straight to Cloudflare, in pieces, picking up where it stopped if the connection drops.
// So by the time the update is written, its videos are usually already up. The update can be posted once they are.

export type VideoLimits = { maxSeconds: number; leftSeconds: number; planName: string };

type Phase = "checking" | "starting" | "uploading" | "paused" | "done" | "failed";

export type VideoDraft = {
  id: string;
  name: string;
  size: number;
  duration: number | null;
  poster: string | null;
  phase: Phase;
  percent: number;
  error: string | null;
};

type Actions = {
  start: (input: { videoId: string; projectId: string; updateId: string; size: number }) => Promise<StartResult>;
  cancel: (videoId: string) => Promise<void>;
};

const serverActions: Actions = { start: startVideoUpload, cancel: cancelVideoUpload };
const working: Phase[] = ["checking", "starting", "uploading", "paused"];

export function useVideoUploads({
  projectId,
  updateId,
  limits,
  actions = serverActions,
}: {
  projectId: string;
  updateId: string;
  limits: VideoLimits | null;
  // The tests swap these for stand-ins.
  actions?: Actions;
}) {
  const [items, setItems] = useState<VideoDraft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Everything the browser needs to keep going between renders (files, uploads in flight, bytes sent).
  const latest = useRef<VideoDraft[]>([]);
  const files = useRef(new Map<string, File>());
  const urls = useRef(new Map<string, string>());
  const uploads = useRef(new Map<string, TusUpload>());
  const started = useRef(new Set<string>());
  const sent = useRef(new Map<string, number>());
  const posted = useRef(false);

  useEffect(() => {
    latest.current = items;
  });

  const patch = useCallback((id: string, change: Partial<VideoDraft>) => {
    setItems((all) => all.map((v) => (v.id === id ? { ...v, ...change } : v)));
  }, []);
  const alive = (id: string) => files.current.has(id);

  const drop = useCallback(
    (id: string) => {
      uploads.current.get(id)?.abort().catch(() => {});
      uploads.current.delete(id);
      urls.current.delete(id);
      sent.current.delete(id);
      files.current.delete(id);
      if (started.current.delete(id)) void actions.cancel(id).catch(() => {});
      setItems((all) => all.filter((v) => v.id !== id));
    },
    [actions],
  );

  const send = useCallback(
    async (id: string) => {
      const file = files.current.get(id);
      const uploadUrl = urls.current.get(id);
      if (!file || !uploadUrl) return;
      patch(id, { phase: "uploading", error: null });
      const { Upload } = await import("tus-js-client");
      if (!alive(id)) return;
      let shown = -1;
      const upload = new Upload(file, {
        uploadUrl,
        chunkSize: VIDEO_CHUNK_BYTES,
        // Quick retries for a blip; a longer outage pauses the upload until the connection is back.
        retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
        storeFingerprintForResuming: false,
        removeFingerprintOnSuccess: true,
        onProgress: (bytes, total) => {
          sent.current.set(id, bytes);
          // At most one change per whole percent, so a big file never floods the page with updates.
          const percent = Math.min(99, Math.floor((bytes / Math.max(total, 1)) * 100));
          if (percent !== shown) {
            shown = percent;
            patch(id, { percent });
          }
        },
        onSuccess: () => {
          sent.current.set(id, file.size);
          patch(id, { phase: "done", percent: 100, error: null });
        },
        onError: (err) => {
          const status = (err as { originalResponse?: { getStatus?: () => number } | null }).originalResponse?.getStatus?.() ?? 0;
          // The link expired or Cloudflare refused the file: starting again is the only way.
          if (status >= 400 && status < 500 && ![408, 409, 423, 429].includes(status)) {
            patch(id, { phase: "failed", error: "This upload can't continue. Remove the video and add it again." });
          } else {
            patch(id, { phase: "paused", error: navigator.onLine ? "The upload stopped. Tap retry to continue." : "Waiting for a connection…" });
          }
        },
      });
      uploads.current.set(id, upload);
      upload.start();
    },
    [patch],
  );

  const begin = useCallback(
    async (id: string, file: File) => {
      const probe = await probeVideo(file).catch(() => ({ duration: null, poster: null }));
      if (!alive(id) || !limits) return;
      // What is left of the month after the other videos on this update.
      const others = latest.current.filter((v) => v.id !== id && v.phase !== "failed");
      const held = others.reduce((sum, v) => sum + (v.duration === null ? limits.maxSeconds : Math.ceil(v.duration)), 0);
      const problem = videoLengthProblem(probe.duration, { ...limits, leftSeconds: limits.leftSeconds - held });
      if (problem) {
        drop(id);
        setNotice(problem);
        return;
      }
      patch(id, { duration: probe.duration, poster: probe.poster, phase: "starting" });

      let result: StartResult;
      try {
        started.current.add(id);
        result = await actions.start({ videoId: id, projectId, updateId, size: file.size });
      } catch {
        // No connection: wait for it (retrying starts afresh, with a new id, in case the server did get the request).
        if (alive(id)) patch(id, { phase: "paused", error: navigator.onLine ? "Couldn't reach BuildPeek. Tap retry." : "Waiting for a connection…" });
        return;
      }
      if (!alive(id)) return;
      if ("error" in result) {
        started.current.delete(id);
        patch(id, { phase: "failed", error: result.error });
        return;
      }
      // The month's minutes changed since the page opened (another upload elsewhere).
      if (probe.duration !== null && Math.floor(probe.duration) > result.maxSeconds) {
        drop(id);
        setNotice(`This video is ${formatClock(probe.duration)} long, but you can add up to ${formatLength(result.maxSeconds)} more video right now.`);
        return;
      }
      urls.current.set(id, result.uploadUrl);
      void send(id);
    },
    [actions, drop, limits, patch, projectId, send, updateId],
  );

  const add = useCallback(
    (list: FileList | null) => {
      if (!list || !limits) return;
      setNotice(null);
      let count = latest.current.length;
      for (const file of Array.from(list)) {
        if (!isVideoFile(file)) {
          setNotice("That file isn't a video. Photos go under Photos.");
          continue;
        }
        if (count >= MAX_VIDEOS_PER_UPDATE) {
          setNotice(`You can add up to ${MAX_VIDEOS_PER_UPDATE} videos to one update.`);
          break;
        }
        if (file.size > MAX_VIDEO_BYTES) {
          setNotice("This file is too big to upload. Please choose a shorter video.");
          continue;
        }
        const id = newId();
        files.current.set(id, file);
        count++;
        setItems((all) => [...all, { id, name: file.name, size: file.size, duration: null, poster: null, phase: "checking", percent: 0, error: null }]);
        void begin(id, file);
      }
    },
    [begin, limits],
  );

  const retry = useCallback(
    (id: string) => {
      const upload = uploads.current.get(id);
      if (upload) {
        // Carry on from where it stopped: Cloudflare says how much has arrived.
        patch(id, { phase: "uploading", error: null });
        upload.start();
        return;
      }
      // It never got an upload link: start again in the same place, as a new video.
      const file = files.current.get(id);
      if (!file) return;
      const fresh = newId();
      files.current.set(fresh, file);
      files.current.delete(id);
      if (started.current.delete(id)) void actions.cancel(id).catch(() => {});
      setItems((all) => all.map((v) => (v.id === id ? { ...v, id: fresh, phase: "checking", error: null } : v)));
      void begin(fresh, file);
    },
    [actions, begin, patch],
  );

  // Back online: carry on with anything that paused.
  useEffect(() => {
    const resume = () => latest.current.filter((v) => v.phase === "paused").forEach((v) => retry(v.id));
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, [retry]);

  const busy = items.some((v) => working.includes(v.phase));
  const uploading = items.some((v) => v.phase === "uploading" || v.phase === "starting");

  // Leaving the page would stop the upload: ask first.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  // Keep the screen on while uploading: a phone that locks itself pauses the upload.
  useEffect(() => {
    if (!uploading || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const take = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then((l) => {
        if (done) l.release().catch(() => {});
        else lock = l;
      }).catch(() => {});
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", take);
      lock?.release().catch(() => {});
    };
  }, [uploading]);

  // Leaving without posting: stop the uploads and give the minutes back (a video that was posted stays).
  useEffect(() => {
    const uploadsNow = uploads.current;
    const startedNow = started.current;
    return () => {
      if (posted.current) return;
      uploadsNow.forEach((u) => u.abort().catch(() => {}));
      startedNow.forEach((id) => void actions.cancel(id).catch(() => {}));
    };
  }, [actions]);

  const percent = useMemo(() => {
    const active = items.filter((v) => working.includes(v.phase) || v.phase === "done");
    const total = active.reduce((s, v) => s + v.size, 0);
    if (total === 0) return 0;
    const done = active.reduce((s, v) => s + (v.phase === "done" ? v.size : Math.round((v.percent / 100) * v.size)), 0);
    return Math.min(99, Math.floor((done / total) * 100));
  }, [items]);

  return {
    items,
    notice,
    busy,
    percent,
    // Waiting for a connection (or a tap on Retry).
    paused: items.some((v) => v.phase === "paused"),
    failed: items.some((v) => v.phase === "failed"),
    readyIds: items.filter((v) => v.phase === "done").map((v) => v.id),
    add,
    remove: drop,
    retry,
    // Call once the update is posted: its videos now belong to it and must not be cancelled.
    markPosted: () => {
      posted.current = true;
    },
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
        Up to {MAX_VIDEOS_PER_UPDATE}, each up to {formatClock(limits.maxSeconds)} long. They upload while you write.
      </p>

      {uploads.items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {uploads.items.map((v, i) => (
            <VideoDraftTile key={v.id} video={v} index={i} onRemove={() => uploads.remove(v.id)} onRetry={() => uploads.retry(v.id)} />
          ))}
        </ul>
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

function VideoDraftTile({ video: v, index, onRemove, onRetry }: { video: VideoDraft; index: number; onRemove: () => void; onRetry: () => void }) {
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
