"use client";

import { useState, useTransition } from "react";
import { setEmailNotifications } from "@/app/dashboard/notifications/actions";

// A switch that saves as soon as it is flipped.
export function EmailToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function flip() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const result = await setEmailNotifications(next);
      if (result.error) {
        setEnabled(!next); // put it back if the save failed
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="email-toggle-label" className="text-sm font-medium">Email me about activity</p>
          <p className="mt-0.5 text-sm text-muted">
            Payments to confirm, new site updates and finished stages. You always see them in the bell too.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="email-toggle-label"
          disabled={pending}
          onClick={flip}
          className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            enabled ? "bg-primary" : "bg-line"
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
