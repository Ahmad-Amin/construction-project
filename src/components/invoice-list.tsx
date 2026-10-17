import Link from "next/link";
import { ChevronRight, Plus, Receipt } from "lucide-react";
import { LinkPending } from "@/components/link-pending";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceNumber, invoiceStatusLabel, type InvoiceListItem } from "@/lib/invoices";
import { button } from "@/lib/ui";

const tone = { draft: "bg-surface-2 text-muted", sent: "bg-success-soft text-success", cancelled: "bg-danger-soft text-danger" } as const;

// The invoices section of the Payments page.
export function InvoiceList({
  projectId,
  invoices,
  canCreate,
  isOwner,
  today,
}: {
  projectId: string;
  invoices: InvoiceListItem[];
  // The owner, on a plan with invoices. (Free owners still see the button; it explains the plan.)
  canCreate: boolean;
  isOwner: boolean;
  today: string;
}) {
  return (
    <section id="invoices" aria-labelledby="invoices-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="invoices-title" className="font-semibold">
          Invoices
          {invoices.length > 0 && <span className="ml-2 text-sm font-normal text-muted">{invoices.length}</span>}
        </h2>
        {isOwner && (
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
          {isOwner
            ? "Create an invoice with your logo and payment details, and send it to your client. They get an email and can download it."
            : "No invoices yet. When your contractor sends you one, you get an email and it appears here."}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {invoices.map((inv) => {
            const overdue = inv.status === "sent" && inv.dueDate !== null && inv.dueDate < today;
            return (
              <li key={inv.id}>
                <Link href={`/dashboard/projects/${projectId}/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <span className="tabular-nums">{inv.number === null ? "Draft, not sent yet" : invoiceNumber(inv.number)}</span>
                      {inv.number !== null && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone[inv.status]}`}>{invoiceStatusLabel[inv.status]}</span>
                      )}
                      {overdue && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-hover">Past due date</span>}
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
