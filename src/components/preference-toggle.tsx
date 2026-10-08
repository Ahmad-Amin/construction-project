"use client";

import { useState, useTransition } from "react";

// A labelled switch that saves as soon as it is flipped, and goes back if the save fails.
export function PreferenceToggle({
  id,
  label,
  description,
  initial,
  save,
}: {
  id: string;
  label: string;
  description: string;
  initial: boolean;
  save: (enabled: boolean) => Promise<{ error?: string }>;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function flip() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const result = await save(next);
      if (result.error) {
        setEnabled(!next);
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id={`${id}-label`} className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby={`${id}-label`}
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
