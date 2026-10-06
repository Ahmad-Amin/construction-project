"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { button } from "@/lib/ui";

// Shown when something unexpected breaks. Plain words, and a way to try again.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <TriangleAlert className="size-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-muted">
        This is on our side, not yours. Check your connection and try again.
      </p>
      <button onClick={() => retry()} className={`${button("primary")} mt-6`}>
        Try again
      </button>
    </div>
  );
}
