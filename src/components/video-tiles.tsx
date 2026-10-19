"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal, preconnect } from "react-dom";
import { AlertTriangle, Play, VideoOff, X } from "lucide-react";
import { videoPlayer, videoStatuses, type PlayerResult } from "@/app/dashboard/projects/[id]/updates/video-actions";
import { Spinner } from "@/components/spinner";
import { formatClock } from "@/lib/video-rules";
import type { VideoItem } from "@/lib/videos";

// The videos of an update, as tiles at the start of its row of photos. A video still being prepared shows that, and
// turns into a playable tile by itself. Tapping a tile plays it in a full-screen player. The player link is private
// and short-lived, so it is fetched when needed: on the way to a tap (hover, touch), so it opens without waiting.

const tile = "relative block h-24 w-40 shrink-0 snap-start overflow-hidden rounded-lg sm:h-28 sm:w-48";

// Player links fetched ahead of a tap, kept for 30 minutes (they last two hours).
const warmed = new Map<string, { at: number; result: Promise<PlayerResult> }>();
function playerFor(id: string) {
  const hit = warmed.get(id);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.result;
  const result = videoPlayer(id).catch((): PlayerResult => ({ error: "Couldn't load the video. Check your connection and try again." }));
  warmed.set(id, { at: Date.now(), result });
  // A failed answer isn't kept, so tapping again tries again.
  result.then((r) => {
    if ("error" in r) warmed.delete(id);
  });
  return result;
}

export function VideoTiles({ videos: given }: { videos: VideoItem[] }) {
  const [videos, setVideos] = useState(given);
  const [from, setFrom] = useState(given);
  // New videos from the server (the page was refreshed) replace what is shown.
  if (from !== given) {
    setFrom(given);
    setVideos(given);
  }
  const [open, setOpen] = useState<string | null>(null);

  // Opening a connection to the video server early makes the first picture and the player quicker.
  const firstThumb = videos.find((v) => v.thumb)?.thumb;
  const origin = firstThumb && /^https?:\/\//.test(firstThumb) ? new URL(firstThumb).origin : null;
  if (origin) preconnect(origin);

  // Check on videos still being prepared: quickly at first, then less often; only while the page is on screen.
  const pending = videos.filter((v) => v.status === "processing").map((v) => v.id).join(",");
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    let delay = 3000;
    let timer: ReturnType<typeof setTimeout>;
    const until = Date.now() + 30 * 60 * 1000;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        try {
          const fresh = await videoStatuses(pending.split(","));
          if (!stopped && fresh.length > 0) setVideos((all) => all.map((v) => fresh.find((f) => f.id === v.id) ?? v));
        } catch {
          // A missed check is fine; the next one tries again.
        }
      }
      delay = Math.min(Math.round(delay * 1.4), 20_000);
      if (!stopped && Date.now() < until) timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pending]);

  if (videos.length === 0) return null;

  return (
    <>
      {videos.map((v, i) =>
        v.status === "ready" && v.thumb ? (
          <li key={v.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpen(v.id)}
              onPointerEnter={() => void playerFor(v.id)}
              onTouchStart={() => void playerFor(v.id)}
              onFocus={() => void playerFor(v.id)}
              aria-label={`Play video ${i + 1}${v.duration ? `, ${formatClock(v.duration)} long` : ""}`}
              className={`group bg-stone-900 ${tile}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URLs */}
              <img src={v.thumb} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/10" aria-hidden />
              <span
                className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
                aria-hidden
              >
                <Play className="size-5 translate-x-px fill-current" />
              </span>
              {v.duration !== null && (
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white" aria-hidden>
                  {formatClock(v.duration)}
                </span>
              )}
            </button>
          </li>
        ) : (
          <li key={v.id} className={`${tile} flex flex-col items-center justify-center gap-1.5 border border-line bg-surface-2 px-3 text-center`}>
            {v.status === "processing" ? (
              <>
                <Spinner className="size-5 text-muted" />
                <span className="text-xs font-medium">Preparing video…</span>
                <span className="text-[11px] leading-tight text-muted">Usually ready in a minute or two</span>
              </>
            ) : v.status === "error" ? (
              <>
                <AlertTriangle className="size-5 text-danger" aria-hidden />
                <span className="text-[11px] leading-tight text-muted">{v.problem}</span>
              </>
            ) : (
              <>
                <VideoOff className="size-5 text-muted" aria-hidden />
                <span className="text-[11px] leading-tight text-muted">This video isn&apos;t available right now.</span>
              </>
            )}
          </li>
        ),
      )}
      {open && <VideoPlayer videoId={open} onClose={() => setOpen(null)} />}
    </>
  );
}

const subscribe = () => () => {};
const chip = "bg-black/70 text-white ring-1 ring-white/25 backdrop-blur-sm";

// Full screen, drawn straight into <body> (like the photo viewer). Cloudflare's player picks the quality to suit the
// connection.
function VideoPlayer({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [result, setResult] = useState<PlayerResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    playerFor(videoId).then((r) => {
      if (live) setResult(r);
    });
    return () => {
      live = false;
    };
  }, [videoId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!mounted) return null;
  const src = result && "src" in result ? result.src : null;
  const error = result && "error" in result ? result.error : null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Video player" className="animate-fade fixed inset-0 z-[60] bg-black/90" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-14 top-16 sm:inset-x-14" onClick={(e) => e.stopPropagation()}>
        {src && (
          <iframe
            src={src}
            title="Site video"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 size-full border-0 transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {!loaded && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white" role="status" aria-label="Loading video">
            <Spinner className="size-8" />
          </div>
        )}
        {error && (
          <p role="alert" className={`absolute left-1/2 top-1/2 w-[min(90%,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl px-4 py-3 text-center text-sm ${chip}`}>
            {error}
          </p>
        )}
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className={`absolute right-3 top-3 flex size-11 items-center justify-center rounded-full ${chip}`}>
        <X className="size-5" aria-hidden />
      </button>
    </div>,
    document.body,
  );
}
