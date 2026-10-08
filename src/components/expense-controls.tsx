"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Spinner } from "@/components/spinner";
import {
  deleteExpense,
  setExpenseVisibility,
  type ActionResult,
} from "@/app/dashboard/projects/[id]/expenses/actions";

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (task: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await task();
      setError(result.error ?? null);
    });
  return { pending, error, run };
}

// Shows whether the homeowner can see an expense. The owner can flip it.
export function VisibilityToggle({
  projectId,
  expenseId,
  visible,
  interactive,
}: {
  projectId: string;
  expenseId: string;
  visible: boolean;
  interactive: boolean;
}) {
  const { pending, error, run } = useAction();
  const Icon = visible ? Eye : EyeOff;
  const style = visible ? "bg-success-soft text-success" : "bg-surface-2 text-muted";
  const label = visible ? "Shown to client" : "Hidden from client";

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
        onClick={() => run(() => setExpenseVisibility(projectId, expenseId, !visible))}
        title={visible ? "Tap to hide from the client" : "Tap to show to the client"}
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

export function DeleteExpenseButton({
  projectId,
  expenseId,
  label,
}: {
  projectId: string;
  expenseId: string;
  label: string;
}) {
  const { pending, error, run } = useAction();

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        aria-label="Delete expense"
        title="Delete expense"
        onClick={() => {
          if (window.confirm(`Delete "${label}"? Its receipt is deleted too, and this can't be undone.`)) {
            run(() => deleteExpense(projectId, expenseId));
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
