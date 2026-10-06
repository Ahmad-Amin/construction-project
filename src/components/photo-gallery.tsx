"use client";

import { useCallback, useState } from "react";
import { Lightbox } from "@/components/lightbox";
import type { UpdatePhoto } from "@/lib/updates";

// Thumbnail grid that opens a full-screen viewer. The links are signed and expire,
// so we never store them; the server hands fresh ones out on every page load.
export function PhotoGallery({ photos }: { photos: UpdatePhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpen((i) => (i === null ? i : (i + delta + photos.length) % photos.length)),
    [photos.length],
  );

  if (photos.length === 0) return null;

  return (
    <>
      <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`View photo ${i + 1} of ${photos.length}`}
              className="block aspect-square w-full overflow-hidden rounded-lg bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URLs */}
              <img src={p.thumb} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      {open !== null && (
        <Lightbox
          images={photos.map((p) => p.full)}
          index={open}
          onClose={close}
          onStep={step}
        />
      )}
    </>
  );
}
