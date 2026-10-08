"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { archiveProject } from "@/app/dashboard/projects/actions";
import { Spinner } from "@/components/spinner";
import { button } from "@/lib/ui";

// Shown at the top of an archived project. The owner can restore it; everyone else just sees the note.
export function ArchivedBanner({ projectId, canRestore }: { projectId: string; canRestore: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div role="status" className="mt-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Archive className="size-4 shrink-0 text-muted" aria-hidden />
        {canRestore
          ? "This project is archived. It's hidden from your lists and dashboard totals."
          : "This project has been archived by your contractor. It's kept here for your records."}
      </p>
      {canRestore && (
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-danger">{error}</span>}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await archiveProject(projectId, false);
                setError(result.error ?? null);
              })
            }
            className={`${button("secondary", "sm")} shrink-0`}
          >
            {pending ? <Spinner /> : <ArchiveRestore className="size-4" aria-hidden />} {pending ? "Restoring…" : "Restore"}
          </button>
        </div>
      )}
    </div>
  );
}
