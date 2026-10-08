"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Spinner } from "@/components/spinner";
import { deleteUpdate } from "@/app/dashboard/projects/[id]/updates/actions";

export function DeleteUpdateButton({
  projectId,
  updateId,
}: {
  projectId: string;
  updateId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        aria-label="Delete this update"
        title="Delete this update"
        onClick={() => {
          if (!window.confirm("Delete this update and its photos? This can't be undone.")) return;
          startTransition(async () => {
            const result = await deleteUpdate(projectId, updateId);
            setError(result.error ?? null);
          });
        }}
        className="flex size-10 items-center justify-center rounded-lg text-danger transition-colors hover:bg-surface-2 disabled:opacity-40"
      >
        {pending ? <Spinner /> : <Trash2 className="size-4" aria-hidden />}
      </button>
      {error && (
        <p role="alert" className="mt-1 max-w-48 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
