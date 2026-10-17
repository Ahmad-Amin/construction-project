import Link from "next/link";
import { Plus } from "lucide-react";
import { LinkPending } from "@/components/link-pending";
import { paidTone } from "@/components/invoice-list";
import { formatDate, formatMoney } from "@/lib/format";
import { canPayInvoice, paidState, paidStateLabel, type InvoiceView } from "@/lib/invoices";
import type { PaymentSide } from "@/lib/payments";
import { button } from "@/lib/ui";

const statusText = { confirmed: "Confirmed", pending: "Awaiting confirmation", disputed: "Disputed" } as const;
const statusTone = { confirmed: "text-success", pending: "text-primary-hover", disputed: "text-danger" } as const;

// On a sent invoice's page: how much of it is paid, from the payments that say they are for it, and a way to record one.
// Only confirmed payments count; a payment waiting for the other side's confirmation is shown but not counted.
export function InvoicePayments({
  invoice,
  side,
  today,
  recordHref,
}: {
  invoice: InvoiceView;
  // Who is looking: the owner records "received", the homeowner "I paid". Staff (null) only look.
  side: PaymentSide | null;
  today: string;
  recordHref: string;
}) {
  const sent = invoice.status === "sent";
  // A cancelled invoice with no payments has nothing to show here.
  if (!sent && invoice.payments.length === 0) return null;
  const state = sent ? paidState(invoice.total, invoice.paid, invoice.dueDate, today) : null;
  // One payment at a time pays the whole invoice: none while another is waiting for confirmation.
  const canRecord = side !== null && canPayInvoice(invoice);

  return (
    <section aria-labelledby="invoice-payments" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="invoice-payments" className="flex items-center gap-2 font-semibold">
          Payments for this invoice
          {state && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${paidTone[state]}`}>{paidStateLabel[state]}</span>}
        </h2>
        {canRecord && (
          <Link href={recordHref} className={button("primary", "sm")}>
            <Plus className="size-4" aria-hidden /> {side === "client" ? "I've paid this invoice" : "Record a payment for it"}
            <LinkPending className="size-4" />
          </Link>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted">Invoice total</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatMoney(invoice.total, invoice.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted">Paid</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-success">{formatMoney(invoice.paid, invoice.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted">Left to pay</dt>
          <dd className={`mt-0.5 font-semibold tabular-nums ${invoice.balance > 0 && sent ? "text-primary-hover" : ""}`}>
            {formatMoney(sent ? invoice.balance : 0, invoice.currency)}
          </dd>
        </div>
      </dl>

      {invoice.payments.length === 0 ? (
        <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
          {side === "client"
            ? "When you pay it, record the payment here. Your contractor confirms it, and the invoice shows as paid."
            : "No payment recorded for this invoice yet. Once one is recorded and the homeowner confirms it, the invoice is paid."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
          {invoice.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2.5">
              <span>
                <span className="font-medium tabular-nums">{formatMoney(p.amount, invoice.currency)}</span>
                <span className="text-muted">
                  {" "}
                  · {formatDate(p.date)} · recorded by {p.side === side ? "you" : p.side === "client" ? "the homeowner" : "the contractor"}
                </span>
              </span>
              <span className={`text-xs font-medium ${statusTone[p.status]}`}>{statusText[p.status]}</span>
            </li>
          ))}
        </ul>
      )}
      {invoice.awaiting > 0 && (
        <p className="mt-2 text-sm text-muted">
          {formatMoney(invoice.awaiting, invoice.currency)} is waiting for confirmation and isn&apos;t counted yet. Once it is
          confirmed, the invoice is paid.
        </p>
      )}
    </section>
  );
}
