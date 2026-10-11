"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import {
  deleteDocument,
  setDocumentVisibility,
  type ActionResult,
} from "@/app/dashboard/projects/[id]/documents/actions";

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const run = (task: () => Promise<ActionResult>, done?: string) =>
    startTransition(async () => {
      const result = await task();
      setError(result.error ?? null);
      if (!result.error && done) toast.success(done);
    });
  return { pending, error, run };
}

// Shows whether the homeowner can open a document. The owner can flip it.
export function DocumentVisibilityToggle({
  projectId,
  documentId,
  visible,
  interactive,
}: {
  projectId: string;
  documentId: string;
  visible: boolean;
  interactive: boolean;
}) {
  const { pending, error, run } = useAction();
  const Icon = visible ? Eye : EyeOff;
  const style = visible ? "bg-success-soft text-success" : "bg-surface-2 text-muted";
  const label = visible ? "Shared with client" : "Not shared";

  if (!interactive) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${style}`}>
        <Icon className="size-3.5" aria-hidden /> {label}
      </span>
    );
  }

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(
            () => setDocumentVisibility(projectId, documentId, !visible),
            visible ? "No longer shared with your client" : "Shared with your client",
          )
        }
        title={visible ? "Tap to stop sharing with the client" : "Tap to share with the client"}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50 ${style}`}
      >
        {pending ? <Spinner className="size-3.5" /> : <Icon className="size-3.5" aria-hidden />} {label}
      </button>
      {error && (
        <span role="alert" className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}

export function DeleteDocumentButton({
  projectId,
  documentId,
  label,
}: {
  projectId: string;
  documentId: string;
  label: string;
}) {
  const { pending, error, run } = useAction();

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        aria-label="Delete document"
        title="Delete document"
        onClick={() => {
          if (window.confirm(`Delete "${label}"? The file is deleted too, and this can't be undone.`)) {
            run(() => deleteDocument(projectId, documentId), "Document deleted");
          }
        }}
        className="flex size-9 items-center justify-center rounded-lg text-danger transition-colors hover:bg-surface-2 disabled:opacity-40"
      >
        {pending ? <Spinner /> : <Trash2 className="size-4" aria-hidden />}
      </button>
      {error && (
        <span role="alert" className="mt-1 block max-w-40 text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
