"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Lightbox } from "@/components/lightbox";
import type { UpdatePhoto } from "@/lib/updates";

// Thumbnails (a grid, or one row that scrolls sideways) that open a full-screen viewer. The links are signed and expire,
// so we never store them; the server hands fresh ones out on every page load. In a row, `lead` goes first (an update's
// videos).
export function PhotoGallery({
  photos,
  layout = "grid",
  lead,
}: {
  photos: UpdatePhoto[];
  layout?: "grid" | "row";
  lead?: React.ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpen((i) => (i === null ? i : (i + delta + photos.length) % photos.length)),
    [photos.length],
  );

  if (photos.length === 0 && !(layout === "row" && lead)) return null;

  const thumb = (p: UpdatePhoto, i: number, className: string) => (
    <li key={p.id} className={className}>
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
  );

  return (
    <>
      {layout === "row" ? (
        <PhotoRow>
          {lead}
          {photos.map((p, i) => thumb(p, i, "size-24 shrink-0 snap-start sm:size-28"))}
        </PhotoRow>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {photos.map((p, i) => thumb(p, i, ""))}
        </ul>
      )}

      {open !== null && (
        <Lightbox
          images={photos.map((p) => p.full)}
          previews={photos.map((p) => p.thumb)}
          index={open}
          onClose={close}
          onStep={step}
        />
      )}
    </>
  );
}

// One row of thumbnails that scrolls sideways: by swipe or trackpad, or with the arrows that show
// at the edges on larger screens when there are more photos than fit.
function PhotoRow({ children }: { children: React.ReactNode }) {
  const list = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const update = () =>
      setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  const scrollBy = (direction: 1 | -1) =>
    list.current?.scrollBy({ left: direction * Math.max(200, (list.current?.clientWidth ?? 0) * 0.8), behavior: "smooth" });

  const arrow =
    "absolute top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/95 text-foreground shadow-md transition-colors hover:bg-surface-2 sm:flex";

  return (
    <div className="relative mt-3">
      <ul
        ref={list}
        className="flex snap-x gap-2 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin]"
        aria-label="Photos and videos"
      >
        {children}
      </ul>
      {edges.left && (
        <button type="button" onClick={() => scrollBy(-1)} aria-label="Scroll photos left" className={`${arrow} left-1`}>
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      )}
      {edges.right && (
        <button type="button" onClick={() => scrollBy(1)} aria-label="Scroll photos right" className={`${arrow} right-1`}>
          <ChevronRight className="size-5" aria-hidden />
        </button>
      )}
    </div>
  );
}
