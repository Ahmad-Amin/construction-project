"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, Bell, CheckCircle2, RotateCw, UploadCloud, WifiOff, X } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { ACTIVE, askToNotify, canAskToNotify, useVideoUploadManager, type VideoUpload } from "@/components/video-upload-manager";

// In the top bar: videos of posted updates that are still uploading (or just finished). It stays put while the person
// moves around BuildPeek; tapping it shows each upload, with retry and stop.

const noop = () => () => {};

function Ring({ percent }: { percent: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] -rotate-90" aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - percent / 100)}
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  );
}

export function VideoUploadIndicator({ compact = false }: { compact?: boolean }) {
  const manager = useVideoUploadManager();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Whether the browser can still be asked about notifications (only known in the browser).
  const [asked, setAsked] = useState(false);
  const askable = useSyncExternalStore(noop, canAskToNotify, () => false) && !asked;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const items = manager?.uploads.filter((u) => u.posted) ?? [];
  if (!manager || items.length === 0) return null;

  const active = items.filter((u) => ACTIVE.includes(u.phase));
  const total = active.reduce((s, u) => s + u.size, 0);
  const percent = total ? Math.min(99, Math.floor(active.reduce((s, u) => s + (u.percent / 100) * u.size, 0) / total * 100)) : 100;
  const paused = active.length > 0 && active.every((u) => u.phase === "paused");
  const failed = items.some((u) => u.phase === "failed");

  const label =
    active.length > 0
      ? paused
        ? compact
          ? "Paused"
          : "Upload paused"
        : compact
          ? `${percent}%`
          : `Uploading ${active.length === 1 ? "video" : `${active.length} videos`} · ${percent}%`
      : failed
        ? compact
          ? "Stopped"
          : "Upload stopped"
        : compact
          ? "Done"
          : "Video uploaded";
  const tone =
    active.length > 0 ? (paused ? "bg-primary-soft text-primary-hover" : "bg-surface-2 text-foreground") : failed ? "bg-danger-soft text-danger" : "bg-success-soft text-success";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Video uploads: ${label}`}
        className={`flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium tabular-nums transition-colors hover:opacity-90 ${tone}`}
      >
        {active.length > 0 ? (
          paused ? <WifiOff className="size-4" aria-hidden /> : <Ring percent={percent} />
        ) : failed ? (
          <AlertTriangle className="size-4" aria-hidden />
        ) : (
          <CheckCircle2 className="size-4" aria-hidden />
        )}
        <span>{label}</span>
      </button>

      {open && (
        <div className="animate-rise absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-3 shadow-2xl">
          <p className="flex items-center gap-2 px-1 pb-2 text-sm font-semibold">
            <UploadCloud className="size-4 text-muted" aria-hidden /> Video uploads
          </p>
          <ul className="space-y-2">
            {items.map((u) => (
              <Row
                key={u.id}
                upload={u}
                onRetry={() => manager.retry(u.id)}
                onDismiss={() => manager.dismiss(u.id)}
                onStop={async () => {
                  if (
                    await confirm({
                      title: "Stop this upload?",
                      message: "The video is taken off the update and won't be shown. The rest of the update stays.",
                      confirmLabel: "Stop upload",
                      cancelLabel: "Keep uploading",
                      tone: "danger",
                    })
                  ) {
                    manager.remove(u.id);
                  }
                }}
              />
            ))}
          </ul>
          {active.length > 0 && (
            <div className="mt-3 border-t border-line px-1 pt-3 text-xs text-muted">
              <p>Keep this tab open until it&apos;s done. You can use the rest of BuildPeek meanwhile.</p>
              {askable && (
                <button
                  type="button"
                  onClick={() => {
                    askToNotify();
                    setAsked(true);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 font-semibold text-data-accent hover:underline"
                >
                  <Bell className="size-3.5" aria-hidden /> Notify me when it&apos;s done
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ upload: u, onRetry, onStop, onDismiss }: { upload: VideoUpload; onRetry: () => void; onStop: () => void; onDismiss: () => void }) {
  const working = ACTIVE.includes(u.phase);
  const status =
    u.phase === "done"
      ? "Uploaded. Ready to watch in a minute or two."
      : u.phase === "failed"
        ? (u.error ?? "This upload stopped.")
        : u.phase === "paused"
          ? (u.error ?? "Paused")
          : u.phase === "uploading"
            ? `Uploading ${u.percent}%`
            : "Getting ready…";
  return (
    <li className="rounded-xl border border-line bg-surface-2/40 p-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{u.projectName || "Site update"}</p>
          <p className="truncate text-xs text-muted" title={u.name}>
            {u.name}
          </p>
          <p className={`mt-1 text-xs ${u.phase === "failed" ? "text-danger" : u.phase === "done" ? "text-success" : u.phase === "paused" ? "text-primary-hover" : "text-muted"}`}>
            {status}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {u.phase === "paused" && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-data-accent hover:bg-surface-2">
              <RotateCw className="size-3.5" aria-hidden /> Retry
            </button>
          )}
          {working ? (
            <button type="button" onClick={onStop} aria-label={`Stop uploading ${u.name}`} title="Stop upload" className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-danger">
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={onDismiss} aria-label="Dismiss" title="Dismiss" className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {(u.phase === "uploading" || u.phase === "paused") && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className={`h-full transition-[width] duration-500 ease-out ${u.phase === "paused" ? "bg-primary/50" : "bg-primary"}`} style={{ width: `${u.percent}%` }} />
        </div>
      )}
    </li>
  );
}
