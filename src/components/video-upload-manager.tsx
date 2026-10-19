"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Upload as TusUpload } from "tus-js-client";
import { cancelVideoUpload, startVideoUpload, type StartResult } from "@/app/dashboard/projects/[id]/updates/video-actions";
import { newId } from "@/lib/ids";
import { probeVideo } from "@/lib/video-probe";
import { formatClock, formatLength, isVideoFile, MAX_VIDEO_BYTES, MAX_VIDEOS_PER_UPDATE, VIDEO_CHUNK_BYTES, videoLengthProblem } from "@/lib/video-rules";

// Every video being uploaded, for the whole app. It lives above all pages, so an upload carries on while the person
// moves around BuildPeek: an update can be posted while its video is still uploading. Each video, as soon as it is
// picked:
//   1. the phone reads its length (one that is too long is refused here, before any data is used),
//   2. the server gets a one-time upload link (and checks the plan, the 2 per update and the month's minutes),
//   3. the file goes straight to Cloudflare in pieces, picking up where it stopped if the connection drops.
// Only closing the tab (or the browser) stops an upload, so that asks first. When an upload finishes while BuildPeek
// is in the background, a browser notification says so (if the person allowed notifications).

export type VideoLimits = { maxSeconds: number; leftSeconds: number; planName: string };

export type Phase = "checking" | "starting" | "uploading" | "paused" | "done" | "failed";

export type VideoUpload = {
  id: string;
  updateId: string;
  projectId: string;
  projectName: string;
  name: string;
  size: number;
  duration: number | null;
  poster: string | null;
  phase: Phase;
  percent: number;
  error: string | null;
  // It has its upload link, so the update can be posted (the upload itself may still be going).
  linked: boolean;
  // Its update has been posted.
  posted: boolean;
};

export type UploadActions = {
  start: (input: { videoId: string; projectId: string; updateId: string; size: number }) => Promise<StartResult>;
  cancel: (videoId: string) => Promise<void>;
};

type AddContext = { projectId: string; updateId: string; projectName: string; limits: VideoLimits };

export type VideoUploadManager = {
  uploads: VideoUpload[];
  // A message for the form of an update being written (a video that was refused, and why).
  notices: Record<string, string | null>;
  // Videos stopped after their update was posted: the update no longer has them.
  stopped: ReadonlySet<string>;
  add: (files: FileList | File[] | null, ctx: AddContext) => void;
  remove: (id: string) => void;
  retry: (id: string) => void;
  markPosted: (updateId: string) => void;
  discard: (updateId: string) => void;
  dismiss: (id: string) => void;
};

const serverActions: UploadActions = { start: startVideoUpload, cancel: cancelVideoUpload };
export const ACTIVE: Phase[] = ["checking", "starting", "uploading", "paused"];

const Context = createContext<VideoUploadManager | null>(null);
export const useVideoUploadManager = () => useContext(Context);

// Ask once (from a tap) whether BuildPeek may show a notification when an upload finishes.
export function askToNotify() {
  if (typeof Notification === "undefined" || Notification.permission !== "default") return;
  Notification.requestPermission().catch(() => {});
}
export const canAskToNotify = () => typeof Notification !== "undefined" && Notification.permission === "default";

function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, { body, icon: "/icons/icon-192.png", tag: "buildpeek-video" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some browsers only allow notifications from an installed app.
  }
}

export function VideoUploadProvider({ children, actions = serverActions }: { children: React.ReactNode; actions?: UploadActions }) {
  const [uploads, setUploads] = useState<VideoUpload[]>([]);
  const [notices, setNotices] = useState<Record<string, string | null>>({});
  const [stopped, setStopped] = useState<ReadonlySet<string>>(() => new Set());

  // What the uploads need between renders: the files, uploads in flight, and which drafts were posted.
  const latest = useRef<VideoUpload[]>([]);
  const files = useRef(new Map<string, File>());
  const tus = useRef(new Map<string, TusUpload>());
  const urls = useRef(new Map<string, string>());
  const started = useRef(new Set<string>());
  const posted = useRef(new Set<string>());
  const contexts = useRef(new Map<string, AddContext>());

  useEffect(() => {
    latest.current = uploads;
  });

  const patch = useCallback((id: string, change: Partial<VideoUpload>) => {
    setUploads((all) => all.map((u) => (u.id === id ? { ...u, ...change } : u)));
  }, []);
  const notice = useCallback((updateId: string, message: string | null) => setNotices((n) => ({ ...n, [updateId]: message })), []);
  const alive = (id: string) => files.current.has(id);

  const forget = useCallback((id: string) => {
    tus.current.get(id)?.abort().catch(() => {});
    tus.current.delete(id);
    urls.current.delete(id);
    files.current.delete(id);
    setUploads((all) => all.filter((u) => u.id !== id));
  }, []);

  // Removes a video: stops the upload, and the server removes it (giving its minutes back).
  const remove = useCallback(
    (id: string) => {
      const u = latest.current.find((x) => x.id === id);
      if (u?.posted && u.phase === "done") return; // part of the update now
      if (u?.posted) setStopped((s) => new Set(s).add(id));
      forget(id);
      if (started.current.delete(id)) void actions.cancel(id).catch(() => {});
    },
    [actions, forget],
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
          // At most one change per whole percent, so a big file never floods the page with updates.
          const percent = Math.min(99, Math.floor((bytes / Math.max(total, 1)) * 100));
          if (percent !== shown) {
            shown = percent;
            patch(id, { percent });
          }
        },
        onSuccess: () => {
          tus.current.delete(id);
          files.current.delete(id);
          patch(id, { phase: "done", percent: 100, error: null });
          const u = latest.current.find((x) => x.id === id);
          if (u?.posted) {
            notify("Video uploaded", `Your video for ${u.projectName || "your project"} is uploaded. It will be ready to watch in a minute or two.`);
            // The update now shows it; the upload list doesn't need to.
            setTimeout(() => setUploads((all) => all.filter((x) => x.id !== id)), 8000);
          } else if (u) {
            notify("Video uploaded", "Your video is uploaded. You can post your update.");
          }
        },
        onError: (err) => {
          const status = (err as { originalResponse?: { getStatus?: () => number } | null }).originalResponse?.getStatus?.() ?? 0;
          if (status >= 400 && status < 500 && ![408, 409, 423, 429].includes(status)) {
            // The link expired, or Cloudflare refused the file: this upload can't continue.
            const u = latest.current.find((x) => x.id === id);
            if (u?.posted) {
              // Take it off the update rather than leave a video that will never arrive.
              setStopped((s) => new Set(s).add(id));
              if (started.current.delete(id)) void actions.cancel(id).catch(() => {});
              patch(id, { phase: "failed", error: "This video couldn't finish uploading, so it was taken off the update. Add it to a new update." });
              notify("Video upload stopped", `Your video for ${u.projectName || "your project"} couldn't finish uploading.`);
            } else {
              patch(id, { phase: "failed", error: "This upload can't continue. Remove the video and add it again." });
            }
          } else {
            patch(id, { phase: "paused", error: navigator.onLine ? "The upload stopped. Tap retry to continue." : "Waiting for a connection…" });
          }
        },
      });
      tus.current.set(id, upload);
      upload.start();
    },
    [actions, patch],
  );

  const begin = useCallback(
    async (id: string, file: File, ctx: AddContext) => {
      const probe = await probeVideo(file).catch(() => ({ duration: null, poster: null }));
      if (!alive(id)) return;
      // What is left of the month after the other videos on this update.
      const others = latest.current.filter((u) => u.updateId === ctx.updateId && u.id !== id && u.phase !== "failed");
      const held = others.reduce((sum, u) => sum + (u.duration === null ? ctx.limits.maxSeconds : Math.ceil(u.duration)), 0);
      const problem = videoLengthProblem(probe.duration, { ...ctx.limits, leftSeconds: ctx.limits.leftSeconds - held });
      if (problem) {
        forget(id);
        notice(ctx.updateId, problem);
        return;
      }
      patch(id, { duration: probe.duration, poster: probe.poster, phase: "starting" });

      let result: StartResult;
      try {
        started.current.add(id);
        result = await actions.start({ videoId: id, projectId: ctx.projectId, updateId: ctx.updateId, size: file.size });
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
        remove(id);
        notice(ctx.updateId, `This video is ${formatClock(probe.duration)} long, but you can add up to ${formatLength(result.maxSeconds)} more video right now.`);
        return;
      }
      urls.current.set(id, result.uploadUrl);
      patch(id, { linked: true });
      void send(id);
    },
    [actions, forget, notice, patch, remove, send],
  );

  const add = useCallback(
    (list: FileList | File[] | null, ctx: AddContext) => {
      if (!list) return;
      notice(ctx.updateId, null);
      let count = latest.current.filter((u) => u.updateId === ctx.updateId).length;
      for (const file of Array.from(list)) {
        if (!isVideoFile(file)) {
          notice(ctx.updateId, "That file isn't a video. Photos go under Photos.");
          continue;
        }
        if (count >= MAX_VIDEOS_PER_UPDATE) {
          notice(ctx.updateId, `You can add up to ${MAX_VIDEOS_PER_UPDATE} videos to one update.`);
          break;
        }
        if (file.size > MAX_VIDEO_BYTES) {
          notice(ctx.updateId, "This file is too big to upload. Please choose a shorter video.");
          continue;
        }
        const id = newId();
        files.current.set(id, file);
        contexts.current.set(id, ctx);
        count++;
        setUploads((all) => [
          ...all,
          {
            id,
            updateId: ctx.updateId,
            projectId: ctx.projectId,
            projectName: ctx.projectName,
            name: file.name,
            size: file.size,
            duration: null,
            poster: null,
            phase: "checking",
            percent: 0,
            error: null,
            linked: false,
            posted: posted.current.has(ctx.updateId),
          },
        ]);
        void begin(id, file, ctx);
      }
    },
    [begin, notice],
  );

  const retry = useCallback(
    (id: string) => {
      const upload = tus.current.get(id);
      if (upload) {
        // Carry on from where it stopped: Cloudflare says how much has arrived.
        patch(id, { phase: "uploading", error: null });
        upload.start();
        return;
      }
      // It never got an upload link: start again in the same place, as a new video.
      const u = latest.current.find((x) => x.id === id);
      const file = files.current.get(id);
      const ctx = contexts.current.get(id);
      if (!u || !file || !ctx || u.linked) return;
      const fresh = newId();
      files.current.set(fresh, file);
      files.current.delete(id);
      contexts.current.set(fresh, ctx);
      if (started.current.delete(id)) void actions.cancel(id).catch(() => {});
      setUploads((all) => all.map((x) => (x.id === id ? { ...x, id: fresh, phase: "checking", error: null } : x)));
      void begin(fresh, file, ctx);
    },
    [actions, begin, patch],
  );

  // The update was posted: its videos belong to it now and keep uploading wherever the person goes.
  const markPosted = useCallback((updateId: string) => {
    posted.current.add(updateId);
    setUploads((all) => all.map((u) => (u.updateId === updateId ? { ...u, posted: true } : u)));
    setNotices((n) => ({ ...n, [updateId]: null }));
  }, []);

  // The form was left without posting: its videos are removed (and their minutes come back).
  const discard = useCallback(
    (updateId: string) => {
      if (posted.current.has(updateId)) return;
      for (const u of latest.current.filter((x) => x.updateId === updateId)) remove(u.id);
      setNotices((n) => ({ ...n, [updateId]: null }));
    },
    [remove],
  );

  const dismiss = useCallback(
    (id: string) => {
      const u = latest.current.find((x) => x.id === id);
      if (u && (u.phase === "done" || u.phase === "failed")) forget(id);
    },
    [forget],
  );

  // Back online: carry on with anything that paused.
  useEffect(() => {
    const resume = () => latest.current.filter((u) => u.phase === "paused").forEach((u) => retry(u.id));
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, [retry]);

  const active = uploads.some((u) => ACTIVE.includes(u.phase));
  const sending = uploads.some((u) => u.phase === "uploading" || u.phase === "starting");

  // Closing the tab is the one thing that stops an upload: ask first.
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  // Keep the screen on while uploading: a phone that locks itself pauses the upload.
  useEffect(() => {
    if (!sending || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const take = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (done) l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", take);
      lock?.release().catch(() => {});
    };
  }, [sending]);

  const value = useMemo<VideoUploadManager>(
    () => ({ uploads, notices, stopped, add, remove, retry, markPosted, discard, dismiss }),
    [uploads, notices, stopped, add, remove, retry, markPosted, discard, dismiss],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
