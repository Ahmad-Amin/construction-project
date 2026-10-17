import Link from "next/link";
import { ChevronRight, Plus, Receipt } from "lucide-react";
import { LinkPending } from "@/components/link-pending";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceNumber, paidState, paidStateLabel, type InvoiceListItem, type PaidState } from "@/lib/invoices";
import { button } from "@/lib/ui";

export const paidTone: Record<PaidState, string> = {
  paid: "bg-success-soft text-success",
  unpaid: "bg-primary-soft text-primary-hover",
  overdue: "bg-danger-soft text-danger",
};

// The Invoices tab of the Payments section.
export function InvoiceList({
  projectId,
  invoices,
  canCreate,
  canManage,
  today,
}: {
  projectId: string;
  invoices: InvoiceListItem[];
  // Allowed to invoice, on a plan with invoices. (Free owners still see the button; it explains the plan.)
  canCreate: boolean;
  // The owner, or staff the owner allowed to invoice on this project.
  canManage: boolean;
  today: string;
}) {
  return (
    <section id="invoices" aria-labelledby="invoices-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="invoices-title" className="font-semibold">
          Invoices
          {invoices.length > 0 && <span className="ml-2 text-sm font-normal text-muted">{invoices.length}</span>}
        </h2>
        {canManage && (
          <Link href={`/dashboard/projects/${projectId}/invoices/new`} className={button("secondary", "sm")}>
            <Plus className="size-4" aria-hidden /> New invoice
            {!canCreate && <span className="rounded-full bg-primary-soft px-1.5 text-[10px] font-bold uppercase text-primary-hover">Pro</span>}
            <LinkPending className="size-4" />
          </Link>
        )}
      </div>

      {invoices.length === 0 ? (
        <p className="flex items-start gap-3 rounded-2xl border border-dashed border-line bg-surface px-4 py-4 text-sm text-muted">
          <Receipt className="mt-0.5 size-4 shrink-0" aria-hidden />
          {canManage
            ? "Create an invoice with your logo and payment details, and send it to your client. They get an email and can download it."
            : "No invoices yet. When your contractor sends you one, you get an email and it appears here."}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {invoices.map((inv) => {
            const state = inv.status === "sent" ? paidState(inv.total, inv.paid, inv.dueDate, today) : null;
            return (
              <li key={inv.id}>
                <Link href={`/dashboard/projects/${projectId}/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <span className="tabular-nums">{inv.number === null ? "Draft, not sent yet" : invoiceNumber(inv.number)}</span>
                      {state && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${paidTone[state]}`}>{paidStateLabel[state]}</span>}
                      {inv.status === "cancelled" && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">Cancelled</span>}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {inv.summary} · {formatDate(inv.issueDate)}
                      {inv.dueDate ? ` · due ${formatDate(inv.dueDate)}` : ""}
                    </p>
                  </div>
                  <p className={`shrink-0 font-semibold tabular-nums ${inv.status === "cancelled" ? "text-muted line-through" : ""}`}>{formatMoney(inv.total, inv.currency)}</p>
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
