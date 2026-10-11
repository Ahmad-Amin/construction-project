import Link from "next/link";
import { Boxes, HardHat, MoreHorizontal, Pencil, Truck, Users, Wrench, type LucideIcon } from "lucide-react";
import { DeleteExpenseButton, VisibilityToggle } from "@/components/expense-controls";
import { LinkPending } from "@/components/link-pending";
import { ReceiptButton } from "@/components/receipt-button";
import { expenseCategoryLabel, type ExpenseCategory, type ExpenseItem } from "@/lib/expenses";
import { formatDate, formatPKR } from "@/lib/format";

const categoryIcon: Record<ExpenseCategory, LucideIcon> = {
  material: Boxes,
  labour: HardHat,
  transport: Truck,
  equipment: Wrench,
  subcontractor: Users,
  other: MoreHorizontal,
};

// One expense, one row: the round icon says what kind of spend it was, the amount sits on the
// right, and whatever you can do with it (receipt, who sees it, edit, delete) is in a quiet strip
// along the bottom.
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
  const Icon = categoryIcon[e.category];
  const hasStrip = !!e.receiptUrl || isTeam;

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-start gap-3 p-4 sm:gap-4 sm:px-5 sm:py-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted sm:size-10">
          <Icon className="size-4 sm:size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="font-semibold">{title}</p>
            {e.note && (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium">
                {expenseCategoryLabel[e.category]}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {formatDate(e.date)}
            {e.createdByName && (
              <>
                <span aria-hidden> · </span>
                Added by {e.createdByName}
              </>
            )}
            {e.edited && <span className="italic"> · Edited</span>}
          </p>
        </div>

        <p className="shrink-0 text-lg font-bold tabular-nums sm:text-xl">{formatPKR(e.amount)}</p>
      </div>

      {hasStrip && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/40 px-4 py-2.5 sm:px-5">
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
                className="relative flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <Pencil className="size-4" aria-hidden />
                <LinkPending className="absolute size-4 rounded-full bg-surface" />
              </Link>
            )}
            {isOwner && <DeleteExpenseButton projectId={projectId} expenseId={e.id} label={title} />}
          </span>
        </div>
      )}
    </article>
  );
}
