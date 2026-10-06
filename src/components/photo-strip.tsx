"use client";

import { useCallback, useState } from "react";
import { Lightbox } from "@/components/lightbox";
import type { UpdatePhoto } from "@/lib/updates";

// A swipeable row of the newest site photos; tap one to open it full screen.
export function PhotoStrip({ photos }: { photos: UpdatePhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (delta: number) => setOpen((i) => (i === null ? i : (i + delta + photos.length) % photos.length)),
    [photos.length],
  );

  return (
    <>
      <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {photos.map((p, i) => (
          <li key={p.id} className="animate-rise snap-start" style={{ animationDelay: `${i * 50}ms` }}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`View photo ${i + 1} of ${photos.length}`}
              className="group block size-28 overflow-hidden rounded-xl bg-surface-2 sm:size-32"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URLs */}
              <img
                src={p.thumb}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && (
        <Lightbox images={photos.map((p) => p.full)} index={open} onClose={close} onStep={step} />
      )}
    </>
  );
}
