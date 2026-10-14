"use client";

import Link from "next/link";
import { createContext, useContext, useEffect } from "react";
import { button } from "@/lib/ui";

// While a form inside the slide-over is saving, the panel must not be closed: leaving mid-upload
// would drop the person back on the list without knowing whether their changes were kept. The panel
// provides this; a form tells it when it is busy.
export const SheetLockContext = createContext<((busy: boolean) => void) | null>(null);

// Call from a form with "is a save in progress". Outside the panel (a full page) it does nothing.
export function useSheetBusy(busy: boolean) {
  const setLocked = useContext(SheetLockContext);
  useEffect(() => {
    if (!setLocked) return;
    setLocked(busy);
    return () => setLocked(false);
  }, [busy, setLocked]);
}

// The form's Cancel button: a link back to the list, switched off while a save is in progress.
export function CancelLink({ href, busy }: { href: string; busy: boolean }) {
  return (
    <Link
      href={href}
      aria-disabled={busy}
      tabIndex={busy ? -1 : undefined}
      onClick={(e) => {
        if (busy) e.preventDefault();
      }}
      className={`${button("secondary")} ${busy ? "pointer-events-none opacity-50" : ""}`}
    >
      Cancel
    </Link>
  );
}
