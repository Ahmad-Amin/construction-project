import Link from "next/link";
import { Pencil, User } from "lucide-react";
import { DeleteExpenseButton, VisibilityToggle } from "@/components/expense-controls";
import { ReceiptButton } from "@/components/receipt-button";
import { expenseCategoryLabel, type ExpenseItem } from "@/lib/expenses";
import { formatDate, formatPKR } from "@/lib/format";

export function ExpenseCard({
  expense: e,
  projectId,
  isTeam,
  isOwner,
  canEdit,
}: {
  expense: ExpenseItem;
  projectId: string;
  isTeam: boolean;
  isOwner: boolean;
  canEdit: boolean;
}) {
  const title = e.note || expenseCategoryLabel[e.category];

  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground">
              {expenseCategoryLabel[e.category]}
            </span>
            <span>{formatDate(e.date)}</span>
            {e.edited && <span className="italic">Edited</span>}
          </p>
        </div>
        <p className="shrink-0 text-lg font-bold tabular-nums">{formatPKR(e.amount)}</p>
      </div>

      {e.createdByName && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted">
          <User className="size-3" aria-hidden /> Added by {e.createdByName}
        </p>
      )}

      {(e.receiptUrl || isTeam) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {e.receiptUrl && <ReceiptButton url={e.receiptUrl} />}
          {isTeam && (
            <VisibilityToggle
              projectId={projectId}
              expenseId={e.id}
              visible={e.clientVisible}
              interactive={isOwner}
            />
          )}
          <span className="ml-auto flex items-center gap-1">
            {canEdit && (
              <Link
                href={`/dashboard/projects/${projectId}/expenses/${e.id}/edit`}
                aria-label="Edit expense"
                title="Edit expense"
                className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <Pencil className="size-4" aria-hidden />
              </Link>
            )}
            {isOwner && <DeleteExpenseButton projectId={projectId} expenseId={e.id} label={title} />}
          </span>
        </div>
      )}
    </article>
  );
}
