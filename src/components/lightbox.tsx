"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// Full-screen image viewer. Used for both site photos and receipts.
export function Lightbox({
  images,
  index,
  onClose,
  onStep,
  label = "Photo",
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onStep: (delta: number) => void;
  label?: string;
}) {
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

  const many = images.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} viewer`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URLs */}
      <img
        src={images[index]}
        alt={many ? `${label} ${index + 1} of ${images.length}` : label}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-white/15 text-white"
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
            className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
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
            className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
          <p className="absolute bottom-4 rounded-full bg-white/15 px-3 py-1 text-sm text-white">
            {index + 1} / {images.length}
          </p>
        </>
      )}
    </div>
  );
}
