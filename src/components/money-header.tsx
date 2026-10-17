import Link from "next/link";
import { AlertTriangle, Banknote, Clock, Receipt } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { PaymentSide } from "@/lib/payments";

type Totals = { confirmedTotal: number; confirmedCount: number; pendingTotal: number; pendingCount: number; disputedCount: number };

// The top of a project's Payments section, the same on both tabs: what has been received (confirmed payments) next to
// what has been invoiced, then the Payments / Invoices switch. "Outstanding" (invoiced minus paid) comes with paid
// tracking: until payments point at invoices, that difference would be wrong whenever a payment wasn't for an invoice.
export function MoneyHeader({
  projectId,
  active,
  currency,
  side,
  totals,
  invoiced,
}: {
  projectId: string;
  active: "payments" | "invoices";
  currency: string;
  // Who is looking: the contractor's owner, the homeowner, or null for site staff.
  side: PaymentSide | null;
  totals: Totals;
  // The invoices this person can see (sent ones), or null when they can't see invoices at all (site staff).
  invoiced: { total: number; count: number; drafts: number } | null;
}) {
  const base = `/dashboard/projects/${projectId}`;
  const isClient = side === "client";

  const tab = (isActive: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
      isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:text-foreground"
    }`;

  return (
    <div className="mb-6 space-y-4">
      <section
        data-tour="total"
        aria-label="Money summary"
        className={`grid overflow-hidden rounded-2xl border border-line bg-surface ${invoiced ? "sm:grid-cols-2 sm:divide-x sm:divide-line" : ""}`}
      >
        <div className="p-5 sm:p-6">
          <p className="text-sm text-muted">{isClient ? "Paid (confirmed)" : "Received (confirmed)"}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-success">{formatMoney(totals.confirmedTotal, currency)}</p>
          <p className="mt-1 text-sm text-muted">
            {totals.confirmedCount} confirmed {totals.confirmedCount === 1 ? "payment" : "payments"}
          </p>
          {(totals.pendingCount > 0 || totals.disputedCount > 0) && (
            <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
              {totals.pendingCount > 0 && (
                <li className="flex items-center gap-2 text-primary-hover">
                  <Clock className="size-4 shrink-0" aria-hidden />
                  {formatMoney(totals.pendingTotal, currency)} awaiting confirmation ({totals.pendingCount})
                </li>
              )}
              {totals.disputedCount > 0 && (
                <li className="flex items-center gap-2 text-danger">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  {totals.disputedCount} disputed, not counted in the total
                </li>
              )}
            </ul>
          )}
        </div>

        {invoiced && (
          <div className="border-t border-line p-5 sm:border-t-0 sm:p-6">
            <p className="text-sm text-muted">{isClient ? "Invoiced to you" : "Invoiced"}</p>
            {invoiced.count > 0 ? (
              <>
                <p className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(invoiced.total, currency)}</p>
                <p className="mt-1 text-sm text-muted">
                  {invoiced.count} {invoiced.count === 1 ? "invoice" : "invoices"} sent
                  {invoiced.drafts > 0 && ` · ${invoiced.drafts} ${invoiced.drafts === 1 ? "draft" : "drafts"}`}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-3xl font-bold text-muted/70">—</p>
                <p className="mt-1 text-sm text-muted">
                  No invoices yet{invoiced.drafts > 0 && ` · ${invoiced.drafts} ${invoiced.drafts === 1 ? "draft" : "drafts"}`}
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {invoiced && (
        <nav aria-label="Payments and invoices" className="flex gap-1 rounded-xl bg-surface-2 p-1 sm:inline-flex">
          <Link href={`${base}/payments`} aria-current={active === "payments" ? "page" : undefined} className={tab(active === "payments")}>
            <Banknote className="size-4" aria-hidden /> Payments
          </Link>
          <Link href={`${base}/invoices`} aria-current={active === "invoices" ? "page" : undefined} className={tab(active === "invoices")}>
            <Receipt className="size-4" aria-hidden /> Invoices
            {invoiced.count + invoiced.drafts > 0 && <span className="text-xs font-medium tabular-nums opacity-70">{invoiced.count + invoiced.drafts}</span>}
          </Link>
        </nav>
      )}
    </div>
  );
}
