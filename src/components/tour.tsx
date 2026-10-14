"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Compass, X } from "lucide-react";
import type { Role } from "@/components/role-tag";
import { markTourSeen } from "@/app/dashboard/tour-actions";
import { tourFor, tourIdForPath, type TourId, type TourStep } from "@/lib/tours";
import { button } from "@/lib/ui";

const START_EVENT = "buildpeek:start-tour";
const PENDING_KEY = "buildpeek-tour-pending";

// The first element with this name that is actually on screen (the sidebar exists on a phone too,
// but hidden; the desktop and phone top bars both have a bell, only one is showing).
function findVisible(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (el.getClientRects().length > 0 && r.width > 0 && r.height > 0) return el;
  }
  return null;
}

type Box = { top: number; left: number; width: number; height: number };

const PAD = 6;
const MARGIN = 12;
const GAP = 14;

// Where the card goes: beside the highlighted thing if there's room, otherwise pinned to the bottom.
function placeCard(box: Box | null, card: { w: number; h: number }, view: { w: number; h: number }) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
  if (!box) return { top: (view.h - card.h) / 2, left: (view.w - card.w) / 2 };

  const centerX = clamp(box.left + box.width / 2 - card.w / 2, MARGIN, view.w - card.w - MARGIN);
  const centerY = clamp(box.top + box.height / 2 - card.h / 2, MARGIN, view.h - card.h - MARGIN);
  const below = { top: box.top + box.height + GAP, left: centerX };
  const above = { top: box.top - GAP - card.h, left: centerX };
  const right = { top: centerY, left: box.left + box.width + GAP };
  const left = { top: centerY, left: box.left - GAP - card.w };

  const fits = {
    below: below.top + card.h + MARGIN <= view.h,
    above: above.top >= MARGIN,
    right: view.w >= 640 && right.left + card.w + MARGIN <= view.w,
    left: view.w >= 640 && left.left >= MARGIN,
  };
  // Things in the left-hand sidebar are best explained to their right.
  const order = box.left < 300 && view.w >= 1024 ? (["right", "below", "above", "left"] as const) : (["below", "above", "right", "left"] as const);
  const spots = { below, above, right, left };
  for (const side of order) if (fits[side]) return spots[side];
  return { top: view.h - card.h - MARGIN, left: (view.w - card.w) / 2 };
}

function TourOverlay({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [view, setView] = useState({ w: 1000, h: 800 });
  const [card, setCard] = useState({ w: 340, h: 200 });
  // The spotlight glides to a new step, but follows the page instantly while it scrolls.
  const [gliding, setGliding] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // Bring the thing into view when the step changes.
  useEffect(() => {
    if (step.target) {
      const el = findVisible(step.target);
      if (el) {
        const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ block: tall ? "start" : "center", inline: "nearest", behavior: calm ? "auto" : "smooth" });
      }
    }
    nextRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Follow the thing as the page scrolls or resizes.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const el = step.target ? findVisible(step.target) : null;
      const r = el?.getBoundingClientRect();
      const next: Box | null = r
        ? { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
        : null;
      setBox((prev) =>
        prev && next && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height
          ? prev
          : next,
      );
      setView((prev) => (prev.w === window.innerWidth && prev.h === window.innerHeight ? prev : { w: window.innerWidth, h: window.innerHeight }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCard((prev) => (prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
  }, [index, view.w]);

  const go = useCallback(
    (delta: number) => {
      if (delta > 0 && index === steps.length - 1) return onClose();
      setGliding(true);
      setTimeout(() => setGliding(false), 350);
      setIndex((i) => Math.max(0, Math.min(steps.length - 1, i + delta)));
    },
    [index, steps.length, onClose],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const cardWidth = Math.min(352, view.w - MARGIN * 2);
  const spot = placeCard(box, { w: cardWidth, h: card.h }, view);

  return (
    // The whole screen is covered so nothing underneath can be clicked while the tour runs.
    <div className="fixed inset-0 z-[200]">
      {box ? (
        <div
          aria-hidden
          className={`pointer-events-none absolute rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ring-2 ring-primary ${
            gliding ? "transition-[top,left,width,height] duration-300 motion-reduce:transition-none" : ""
          }`}
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/60" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className={`absolute rounded-2xl border border-line bg-surface p-5 shadow-2xl ${
          gliding ? "transition-[top,left] duration-300 motion-reduce:transition-none" : ""
        }`}
        style={{ top: spot.top, left: spot.left, width: cardWidth }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the tour"
          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>

        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-data-accent">
          <Compass className="size-3.5" aria-hidden /> {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title" className="pr-6 text-base font-bold tracking-tight">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-primary" : "w-1.5 bg-line"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {last ? null : (
              <button type="button" onClick={onClose} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted hover:text-foreground">
                Skip
              </button>
            )}
            {index > 0 && (
              <button type="button" onClick={() => go(-1)} className={button("secondary", "sm")}>
                Back
              </button>
            )}
            <button ref={nextRef} type="button" onClick={() => go(1)} className={button("primary", "sm")}>
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Starts the tour for the page being looked at: by itself the first time (once per person, per tour, on
// this browser), and again whenever "Take a tour" is pressed.
export function TourHost({ pathname, role, seen }: { pathname: string; role: Role; seen: string[] }) {
  const [running, setRunning] = useState<{ id: TourId; steps: TourStep[] } | null>(null);
  // Tours opened during this visit: the account's record catches up a moment later, and meanwhile it must not start twice.
  const opened = useRef(new Set<string>());

  const start = useCallback(
    (id: TourId) => {
      // The tour is for desktop and larger screens; phones don't get it.
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      // Only the steps whose target is on screen; with fewer than two, there is no tour to give.
      const steps = tourFor(id, role).filter((s) => !s.target || findVisible(s.target));
      if (steps.length < 2) return;
      // Counts as seen from the moment it opens, so leaving halfway never brings it back uninvited.
      // It is kept on the person's account, so it holds on any device.
      if (!opened.current.has(id)) {
        opened.current.add(id);
        void markTourSeen(id);
      }
      setRunning({ id, steps });
    },
    [role],
  );

  const finish = useCallback(() => setRunning(null), []);

  // A tour belongs to the page it started on: moving to another page ends it.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setRunning(null);
  }

  // The first visit, or a tour asked for from another page ("Take a tour" in the menu).
  useEffect(() => {
    const id = tourIdForPath(pathname);
    if (!id) return;
    let asked = false;
    try {
      const at = Number(window.sessionStorage.getItem(PENDING_KEY));
      asked = !!at && Date.now() - at < 15_000;
    } catch {}
    if (!asked && (seen.includes(id) || opened.current.has(id))) return;
    const timer = setTimeout(() => {
      try {
        window.sessionStorage.removeItem(PENDING_KEY);
      } catch {}
      start(id);
    }, 900);
    return () => clearTimeout(timer);
  }, [pathname, start, seen]);

  useEffect(() => {
    const onStart = () => {
      const id = tourIdForPath(pathname);
      if (id) start(id);
    };
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, [pathname, start]);

  if (!running) return null;
  return createPortal(<TourOverlay key={running.id} steps={running.steps} onClose={finish} />, document.body);
}

// The "Take a tour" button in the top bar, beside the theme switch. On a page with no tour, it goes to the
// right one first.
export function TourButton({ pathname }: { pathname: string }) {
  const router = useRouter();

  function onClick() {
    if (tourIdForPath(pathname)) {
      window.dispatchEvent(new Event(START_EVENT));
      return;
    }
    try {
      window.sessionStorage.setItem(PENDING_KEY, String(Date.now()));
    } catch {}
    const project = pathname.match(/^\/dashboard\/projects\/([0-9a-f-]{36})/);
    router.push(project ? `/dashboard/projects/${project[1]}` : "/dashboard");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Take a tour"
      title="Take a tour"
      className="flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      <Compass className="size-5" aria-hidden />
    </button>
  );
}
