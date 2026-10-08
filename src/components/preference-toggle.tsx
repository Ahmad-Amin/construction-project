"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Spinner } from "@/components/spinner";

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
  const [saved, setSaved] = useState(false);
  const saveSucceeded = useRef(false);

  // Show the tick once the page has finished catching up with the save, not when the server
  // first answers (the two can be seconds apart on a slow connection).
  useEffect(() => {
    if (pending || !saveSucceeded.current) return;
    saveSucceeded.current = false;
    setSaved(true);
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [pending]);

  function flip() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    setSaved(false);
    saveSucceeded.current = false;
    startTransition(async () => {
      const result = await save(next);
      if (result.error) {
        setEnabled(!next);
        setError(result.error);
        return;
      }
      saveSucceeded.current = true;
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id={`${id}-label`} className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
        <span className="mt-1 flex h-6 w-16 shrink-0 items-center justify-end gap-1 text-xs font-medium text-muted" aria-live="polite">
          {pending ? (
            <>
              <Spinner className="size-3.5" /> Saving
            </>
          ) : saved ? (
            <span className="flex items-center gap-1 text-success">
              <Check className="size-3.5" aria-hidden /> Saved
            </span>
          ) : null}
        </span>
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
