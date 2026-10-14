"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { SheetLockContext } from "@/components/sheet-lock";

const subscribe = () => () => {};

// A slide-over panel for forms that open on top of a page: the list stays visible (dimmed) behind
// it. It is drawn straight into <body> so nothing in the page layout (blur effects, scroll boxes)
// can trap or clip it, and it fills the whole screen on a phone. Escape, the close button and a
// click on the dimmed area all go back to the page underneath, except while a form inside is saving. The content has no bottom padding
// of its own, so a bar pinned along the bottom of a form sits flush with the edge of the panel.
export function Sheet({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  // True while a form inside is saving: the panel then refuses to close (see sheet-lock.tsx).
  const [locked, setLocked] = useState(false);
  const close = () => {
    if (!locked) router.back();
  };
  // Portals only exist in the browser; this is false while the server renders and true after.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  useEffect(() => {
    if (!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Escape belongs to an open date or country picker first; only a second press closes the panel.
      if (panel.current?.querySelector('[aria-expanded="true"]')) return;
      if (locked) return;
      router.back();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [mounted, router, locked]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className="animate-fade absolute inset-0 cursor-default bg-black/50"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        className="animate-sheet absolute inset-y-0 right-0 flex w-full flex-col bg-background shadow-2xl outline-none sm:max-w-xl sm:border-l sm:border-line"
      >
        <button
          type="button"
          onClick={close}
          disabled={locked}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <X className="size-5" aria-hidden />
        </button>
        <SheetLockContext.Provider value={setLocked}>
          <div className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-5 pt-6 sm:px-8 sm:pt-8">{children}</div>
        </SheetLockContext.Provider>
      </div>
    </div>,
    document.body,
  );
}
