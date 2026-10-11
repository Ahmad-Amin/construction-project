"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Spinner } from "@/components/spinner";

// The controls sit on a dark chip, not a see-through one, so they stay readable on a bright photo.
const chip = "bg-black/70 text-white ring-1 ring-white/25 backdrop-blur-sm";

// Full-screen image viewer. Used for both site photos and receipts.
//
// Opening a photo only loads its small preview; the full-size picture arrives on demand. To keep
// stepping quick, the photos next to the current one are fetched ahead of time, and while a
// full-size photo is still arriving the small preview is shown (enlarged) in its place.
export function Lightbox({
  images,
  index,
  onClose,
  onStep,
  label = "Photo",
  previews,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onStep: (delta: number) => void;
  label?: string;
  // Small versions of the same images, in the same order, for the placeholder.
  previews?: string[];
}) {
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onStep(-1);
      if (e.key === "ArrowRight") onStep(1);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, onStep]);

  // Fetch the next and previous photos (and the ones after them) before they are asked for.
  useEffect(() => {
    const n = images.length;
    if (n < 2) return;
    const nearby = new Set([1, -1, 2, -2].map((d) => images[(index + d + n) % n]));
    nearby.delete(images[index]);
    for (const url of nearby) {
      const img = new Image();
      img.onload = () => setLoaded((seen) => new Set(seen).add(url));
      img.src = url;
    }
  }, [index, images]);

  const many = images.length > 1;
  const src = images[index];
  const preview = previews?.[index];
  const ready = loaded.has(src);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} viewer`}
      className="fixed inset-0 z-50 bg-black/90"
      onClick={onClose}
    >
      {/* The picture gets its own padded area, so the buttons and the counter never sit on top of it. */}
      <div className="absolute inset-x-0 bottom-16 top-16 sm:inset-x-16">
        {!ready && preview && (
          // eslint-disable-next-line @next/next/no-img-element -- small signed preview
          <img src={preview} alt="" aria-hidden className="absolute inset-0 size-full object-contain blur-sm" />
        )}
        {!ready && (
          <div className="pending-hint pointer-events-none absolute inset-0 flex items-center justify-center text-white" role="status" aria-label="Loading photo">
            <Spinner className="size-8" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URLs */}
        <img
          key={src}
          src={src}
          alt={many ? `${label} ${index + 1} of ${images.length}` : label}
          onLoad={() => setLoaded((seen) => (seen.has(src) ? seen : new Set(seen).add(src)))}
          className={`absolute inset-0 size-full object-contain transition-opacity duration-150 ${ready ? "opacity-100" : "opacity-0"}`}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className={`absolute right-3 top-3 flex size-11 items-center justify-center rounded-full ${chip}`}
      >
        <X className="size-5" aria-hidden />
      </button>
      {many && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStep(-1);
            }}
            aria-label={`Previous ${label.toLowerCase()}`}
            className={`absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full ${chip}`}
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStep(1);
            }}
            aria-label={`Next ${label.toLowerCase()}`}
            className={`absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full ${chip}`}
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
          <p className={`absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full px-4 py-1.5 text-sm font-medium tabular-nums ${chip}`}>
            {index + 1} / {images.length}
          </p>
        </>
      )}
    </div>
  );
}
