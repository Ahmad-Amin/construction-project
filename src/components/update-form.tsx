"use client";


import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Images, X } from "lucide-react";
import { createUpdate } from "@/app/dashboard/projects/[id]/updates/actions";
import { DateField } from "@/components/date-field";
import { newId } from "@/lib/ids";
import { prepareImage } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { button, inputClass } from "@/lib/ui";
import { uploadWithRetry } from "@/lib/upload";
import { useToast } from "@/components/toast";

const MAX_PHOTOS = 10;

type PhotoItem = { id: string; file: File; preview: string };
type Uploaded = { path: string; thumb: string | null };

export function UpdateForm({
  projectId,
  milestones,
  today,
}: {
  projectId: string;
  milestones: { id: string; name: string; progress_percent: number }[];
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  // One id per draft. Retrying a failed post re-uses it, so it can never post twice.
  const updateId = useRef(newId());
  const uploaded = useRef(new Map<string, Uploaded>());

  const [text, setText] = useState("");
  const [date, setDate] = useState(today);
  const [milestoneId, setMilestoneId] = useState("");
  const [progress, setProgress] = useState(0);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = status !== null;

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
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
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
    if (busy) return;
    if (!text.trim()) {
      setError("Please write a short update.");
      return;
    }
    setError(null);

    try {
      const supabase = createClient();
      const base = `${projectId}/updates/${updateId.current}`;

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
        id: updateId.current,
        projectId,
        date,
        text,
        milestoneId: milestoneId || null,
        progress: selected && progress !== selected.progress_percent ? progress : null,
        photos: photos.map((p) => uploaded.current.get(p.id)!),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("Update posted");
      router.push(`/dashboard/projects/${projectId}/updates?posted=${updateId.current}`);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
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
              className="h-8 w-full accent-primary"
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-semibold">Photos</h2>
        <p className="mt-0.5 text-sm text-muted">Up to {MAX_PHOTOS}. They are resized automatically.</p>

        {photos.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p, i) => (
              <li key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={p.preview} alt={`Selected photo ${i + 1}`} className="size-full object-cover" />
                {!busy && (
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-black/65 text-white"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy || photos.length >= MAX_PHOTOS}
            onClick={() => cameraInput.current?.click()}
            className={button("secondary")}
          >
            <Camera className="size-5" aria-hidden /> Take photo
          </button>
          <button
            type="button"
            disabled={busy || photos.length >= MAX_PHOTOS}
            onClick={() => galleryInput.current?.click()}
            className={button("secondary")}
          >
            <Images className="size-5" aria-hidden /> Choose from gallery
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
      </section>

      <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
        Your client sees this update and its photos as soon as you post it.
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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={`/dashboard/projects/${projectId}/updates`} className={button("secondary")}>
          Cancel
        </Link>
        <button type="submit" disabled={busy} className={button("primary")}>
          {busy ? "Please wait…" : "Post update"}
        </button>
      </div>
    </form>
  );
}
