"use client";


import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Spinner } from "@/components/spinner";
import { deleteUpdate } from "@/app/dashboard/projects/[id]/updates/actions";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm-dialog";

export function DeleteUpdateButton({
  projectId,
  updateId,
}: {
  projectId: string;
  updateId: string;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        aria-label="Delete this update"
        title="Delete this update"
        onClick={async () => {
          if (!(await confirm({ title: "Delete this update?", message: "Its photos are deleted too, and this can't be undone.", confirmLabel: "Delete update", tone: "danger" }))) return;
          startTransition(async () => {
            const result = await deleteUpdate(projectId, updateId);
            setError(result.error ?? null);
            if (!result.error) toast.success("Update deleted");
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
