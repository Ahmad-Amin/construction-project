"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SCHEDULE_COOKIE } from "@/lib/sidebar";

// The payment schedule card, which the person can fold down to its heading and totals. Shown by
// default; the choice is a cookie so the page is drawn the right way on the first paint.
export function ScheduleCollapse({
  summary,
  actions,
  initialHidden,
  paidCount,
  openCount,
  children,
}: {
  summary: React.ReactNode;
  actions?: React.ReactNode;
  initialHidden: boolean;
  // Paid instalments are tucked away by default: the payment itself is listed below.
  paidCount: number;
  openCount: number;
  children: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(initialHidden);
  const [showPaid, setShowPaid] = useState(false);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    document.cookie = `${SCHEDULE_COOKIE}=${next ? "hidden" : "shown"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface">
      <div className="flex items-start justify-between gap-3 p-5 sm:px-6">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!hidden}
          aria-controls="payment-schedule-list"
          className="-m-1 min-w-0 flex-1 rounded-lg p-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="flex items-center gap-1.5 font-semibold">
            Payment schedule
            <ChevronDown
              className={`size-4 text-muted transition-transform ${hidden ? "-rotate-90" : ""}`}
              aria-hidden
            />
            <span className="sr-only">{hidden ? "Show" : "Hide"}</span>
          </span>
          <span className="mt-1 block text-sm text-muted">{summary}</span>
        </button>
        {!hidden && actions}
      </div>

      <div id="payment-schedule-list" hidden={hidden}>
        {paidCount > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-2.5 sm:px-6">
            <p className="text-sm text-muted">
              {showPaid ? "Showing everything" : openCount === 0 ? "Everything is paid" : "Showing what's still to pay"}
            </p>
            <button
              type="button"
              onClick={() => setShowPaid((v) => !v)}
              aria-pressed={showPaid}
              className="rounded-lg px-2 py-1 text-sm font-medium underline underline-offset-4 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {showPaid ? "Hide paid" : `Show paid (${paidCount})`}
            </button>
          </div>
        )}
        <div className={showPaid ? "" : "[&_li[data-paid]]:hidden"}>{children}</div>
      </div>
    </section>
  );
}
