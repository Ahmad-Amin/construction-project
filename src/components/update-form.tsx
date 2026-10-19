"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Images, Info, X } from "lucide-react";
import { createUpdate } from "@/app/dashboard/projects/[id]/updates/actions";
import { DateField } from "@/components/date-field";
import { newId } from "@/lib/ids";
import { IMAGE_TOO_BIG, imageTooBig, prepareImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { CancelLink, useSheetBusy } from "@/components/sheet-lock";
import { button, inputClass } from "@/lib/ui";
import { uploadWithRetry } from "@/lib/upload";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";
import { askToNotify } from "@/components/video-upload-manager";
import { useVideoUploads, VideoField, type VideoLimits } from "@/components/video-uploads";

const MAX_PHOTOS = 10;

type PhotoItem = { id: string; file: File; preview: string };
type Uploaded = { path: string; thumb: string | null };

export function UpdateForm({
  projectId,
  milestones,
  today,
  video = null,
  projectName = "",
  sheet = false,
}: {
  projectId: string;
  milestones: { id: string; name: string; progress_percent: number }[];
  today: string;
  // Site videos: null when they are switched off; `limits` null when the plan has none.
  video?: { limits: VideoLimits | null; upgradeHref: string | null } | null;
  // For the upload list and notifications ("your video for 12 Marla House…").
  projectName?: string;
  // Shown in the slide-over panel: the buttons stay in view along the bottom while the form scrolls.
  sheet?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  // One id per draft. Retrying a failed post re-uses it, so it can never post twice. Videos are added to it too.
  const [updateId] = useState(newId);
  const uploaded = useRef(new Map<string, Uploaded>());
  const videos = useVideoUploads({ projectId, updateId, projectName, limits: video?.limits ?? null });
  const videoBusy = videos.preparing || videos.uploading;

  const [text, setText] = useState("");
  const [date, setDate] = useState(today);
  const [milestoneId, setMilestoneId] = useState("");
  const [progress, setProgress] = useState(0);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = status !== null;
  // Closing the panel by accident would remove a video still uploading for this update (posting keeps it going).
  useSheetBusy(busy || videoBusy);
  const back = `/dashboard/projects/${projectId}/updates`;

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  // Free the in-browser previews when leaving the page.
  const previews = useRef<string[]>([]);
  useEffect(() => {
    previews.current = photos.map((p) => p.preview);
  });
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const selected = milestones.find((m) => m.id === milestoneId);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const images = picked.filter((f) => !imageTooBig(f));
    if (images.length < picked.length) setError(IMAGE_TOO_BIG);
    setPhotos((current) => {
      const room = MAX_PHOTOS - current.length;
      const added = images.slice(0, Math.max(room, 0)).map((file) => ({
        id: newId(),
        file,
        preview: URL.createObjectURL(file),
      }));
      return [...current, ...added];
    });
    if (images.length > MAX_PHOTOS - photos.length) {
      setError(`You can add up to ${MAX_PHOTOS} photos to one update.`);
    }
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const gone = current.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((p) => p.id !== id);
    });
    uploaded.current.delete(id);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || videos.preparing) return;
    if (!text.trim()) {
      setError("Please write a short update.");
      return;
    }
    if (videos.failed) {
      setError("One of the videos didn't upload. Remove it (or add it again), then post.");
      return;
    }
    setError(null);
    // The video carries on uploading after posting: offer a notification for when it's done (this tap allows asking).
    if (videos.uploading) askToNotify();

    try {
      const supabase = createClient();
      const base = `${projectId}/updates/${updateId}`;

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        if (uploaded.current.has(photo.id)) continue; // sent on an earlier try
        setStatus(`Uploading photo ${i + 1} of ${photos.length}…`);

        let prepared;
        try {
          prepared = await prepareImage(photo.file);
        } catch {
          setError(`Photo ${i + 1} couldn't be read. Remove it and try again.`);
          return;
        }

        const path = `${base}/${photo.id}.jpg`;
        const thumbPath = `${base}/${photo.id}_thumb.jpg`;
        const [fullOk, thumbOk] = await Promise.all([
          uploadWithRetry(supabase, path, prepared.full),
          uploadWithRetry(supabase, thumbPath, prepared.thumb),
        ]);
        if (!fullOk) {
          setError(
            `Photo ${i + 1} didn't upload. Check your connection and tap Post update again. Your text and the other photos are kept.`,
          );
          return;
        }
        uploaded.current.set(photo.id, { path, thumb: thumbOk ? thumbPath : null });
      }

      setStatus("Posting update…");
      const result = await createUpdate({
        id: updateId,
        projectId,
        date,
        text,
        milestoneId: milestoneId || null,
        progress: selected && progress !== selected.progress_percent ? progress : null,
        photos: photos.map((p) => uploaded.current.get(p.id)!),
        videos: videos.postableIds,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      videos.markPosted();
      toast.success(
        videos.uploading
          ? "Update posted. Its video keeps uploading; keep BuildPeek open until it's done."
          : videos.postableIds.length > 0
            ? "Update posted. Its video will be ready to watch in a minute or two."
            : "Update posted",
      );
      router.push(`/dashboard/projects/${projectId}/updates?posted=${updateId}`);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className={sheet ? "flex flex-1 flex-col gap-4" : "space-y-4"}>
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">What happened on site?</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            required
            placeholder="Roof slab cast today. Curing starts tomorrow."
            className={inputClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Date</span>
            <DateField value={date} onValueChange={setDate} max={today} today={today} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Related milestone</span>
            <select
              value={milestoneId}
              onChange={(e) => {
                setMilestoneId(e.target.value);
                setProgress(milestones.find((m) => m.id === e.target.value)?.progress_percent ?? 0);
              }}
              className={inputClass}
            >
              <option value="">None</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.progress_percent}%)
                </option>
              ))}
            </select>
          </label>
        </div>

        {selected && (
          <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">Update {selected.name} progress</span>
              <span className="text-lg font-bold tabular-nums">{progress}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              aria-label={`${selected.name} progress`}
              className="h-6 w-full accent-primary"
            />
          </div>
        )}

        <div className="border-t border-line pt-4">
          <p className="text-sm font-medium">Photos</p>
          <p className="mt-0.5 text-xs text-muted">Up to {MAX_PHOTOS}. They are resized automatically.</p>

          {photos.length > 0 && (
            <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {photos.map((p, i) => (
                <li key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  <img src={p.preview} alt={`Selected photo ${i + 1}`} className="size-full object-cover" />
                  {!busy && (
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      aria-label={`Remove photo ${i + 1}`}
                      className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/65 text-white"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || photos.length >= MAX_PHOTOS}
              onClick={() => cameraInput.current?.click()}
              className={button("secondary", "sm")}
            >
              <Camera className="size-4" aria-hidden /> Take photo
            </button>
            <button
              type="button"
              disabled={busy || photos.length >= MAX_PHOTOS}
              onClick={() => galleryInput.current?.click()}
              className={button("secondary", "sm")}
            >
              <Images className="size-4" aria-hidden /> Choose from gallery
            </button>
          </div>

          {/* `capture` opens the camera directly on phones; the gallery input allows several at once. */}
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {video && <VideoField uploads={videos} limits={video.limits} disabled={busy} upgradeHref={video.upgradeHref} />}
      </section>

      <p className="flex items-start gap-2 px-1 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        Your client sees this update and its {video?.limits ? "photos and videos" : "photos"} as soon as you post it.
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
          {status}
        </p>
      )}

      <div
        className={`flex justify-end gap-2 ${
          sheet
            ? "sticky bottom-0 z-10 -mx-5 mt-auto border-t border-line bg-background/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-8 sm:px-8"
            : "pt-1"
        }`}
      >
        {videoBusy && !busy ? (
          <button
            type="button"
            onClick={async () => {
              if (
                await confirm({
                  title: "Leave without posting?",
                  message: "The video stops uploading and this update isn't posted. To keep the video, post the update instead.",
                  confirmLabel: "Stop and leave",
                  cancelLabel: "Stay",
                  tone: "danger",
                })
              ) {
                router.push(back);
              }
            }}
            className={button("secondary")}
          >
            Cancel
          </button>
        ) : (
          <CancelLink href={back} busy={busy} />
        )}
        <button type="submit" disabled={busy || videos.preparing} className={`${button("primary")} tabular-nums`}>
          {busy ? "Please wait…" : videos.preparing ? "Preparing video…" : "Post update"}
        </button>
      </div>
    </form>
  );
}
