"use client";


import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Trash2, TriangleAlert } from "lucide-react";
import { archiveProject, deleteProject } from "@/app/dashboard/projects/actions";
import { Spinner } from "@/components/spinner";
import { button, inputClass } from "@/lib/ui";
import { useToast } from "@/components/toast";

export type DeleteCounts = {
  milestones: number;
  updates: number;
  photos: number;
  expenses: number;
  receipts: number;
  payments: number;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function ProjectDangerZone({
  projectId,
  projectName,
  archived,
  counts,
  blocker,
}: {
  projectId: string;
  projectName: string;
  archived: boolean;
  counts: DeleteCounts;
  // Why the project can't be deleted, or null if it can.
  blocker: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function toggleArchive() {
    setError(null);
    startTransition(async () => {
      const result = await archiveProject(projectId, !archived);
      if (result.error) setError(result.error);
      else toast.success(archived ? "Project restored" : "Project archived");
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      // On success the server sends us to the dashboard; we only come back here on an error.
      const result = await deleteProject(projectId, typed);
      if (result?.error) setError(result.error);
    });
  }

  const matches = typed.trim() === projectName.trim();

  return (
    <section className="mt-10 rounded-2xl border border-danger/30 bg-surface">
      <h2 className="border-b border-line px-5 py-4 font-semibold sm:px-6">Archive or delete</h2>

      <div className="flex flex-col gap-3 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-medium">{archived ? "This project is archived" : "Archive this project"}</p>
          <p className="mt-0.5 max-w-lg text-sm text-muted">
            {archived
              ? "It's tucked away from your lists and dashboard totals. Restore it any time."
              : "Finished or paused? Archiving tucks it away from your lists and totals. Nothing is lost, your client keeps their view, and you can restore it any time."}
          </p>
        </div>
        <button type="button" onClick={toggleArchive} disabled={pending} className={`${button("secondary", "sm")} shrink-0`}>
          {pending ? <Spinner /> : archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
          {pending ? (archived ? "Restoring…" : "Archiving…") : archived ? "Restore project" : "Archive project"}
        </button>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <p className="font-medium text-danger">Delete this project</p>
        <p className="mt-0.5 max-w-lg text-sm text-muted">
          For mistakes and test projects. This is permanent and can&apos;t be undone.
        </p>

        {blocker ? (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-4 py-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <span>{blocker}</span>
          </p>
        ) : !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-danger/40 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
          >
            <Trash2 className="size-4" aria-hidden /> Delete project…
          </button>
        ) : (
          <div className="mt-4 space-y-4 rounded-xl border border-danger/30 bg-danger-soft/40 p-4">
            <div className="text-sm">
              <p className="font-semibold">This will permanently delete:</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                <li>{plural(counts.milestones, "milestone")}</li>
                <li>
                  {plural(counts.updates, "site update")} and {plural(counts.photos, "photo")}
                </li>
                <li>
                  {plural(counts.expenses, "expense")} and {plural(counts.receipts, "receipt")}
                </li>
                <li>{plural(counts.payments, "payment")} (none of them confirmed)</li>
              </ul>
              <p className="mt-2 text-muted">
                The client&apos;s contact details go too, unless they have another project with you. Their login stays.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Type <span className="font-bold">{projectName}</span> to confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className={inputClass}
              />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={remove}
                disabled={!matches || pending}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-danger px-5 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:text-stone-900"
              >
                <Trash2 className="size-4" aria-hidden /> {pending ? "Deleting…" : "Delete forever"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setTyped("");
                  setError(null);
                }}
                disabled={pending}
                className={button("secondary")}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
