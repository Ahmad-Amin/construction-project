import { formatDate, formatMoney } from "@/lib/format";
import { invoiceNumber, type InvoiceView } from "@/lib/invoices";

// The invoice as a sheet of paper, the same in light and dark mode, so what the owner previews is what the homeowner
// gets (and what the PDF looks like).
export function InvoicePaper({ invoice: v }: { invoice: InvoiceView }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 shadow-sm sm:p-10">
      {v.status === "cancelled" && (
        <p aria-hidden className="pointer-events-none absolute inset-0 flex -rotate-12 items-center justify-center text-5xl font-black uppercase tracking-widest text-red-600/10 sm:text-7xl">
          Cancelled
        </p>
      )}
      {v.status === "draft" && (
        <p aria-hidden className="pointer-events-none absolute inset-0 flex -rotate-12 items-center justify-center text-5xl font-black uppercase tracking-widest text-stone-900/[0.05] sm:text-7xl">
          Draft
        </p>
      )}

      <header className="flex flex-col gap-6 border-b-2 border-amber-500 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {v.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the company's own logo from storage
            <img src={v.company.logoUrl} alt="" className="size-12 rounded-lg object-contain" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-lg bg-amber-100 text-xl font-bold text-amber-700">
              {v.company.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-lg font-bold">{v.company.name}</p>
            {v.company.details && <p className="whitespace-pre-line text-sm text-stone-600">{v.company.details}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Invoice</p>
          <p className="text-2xl font-bold tabular-nums">{invoiceNumber(v.number)}</p>
        </div>
      </header>

      <div className="grid gap-6 py-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Bill to</p>
          <p className="mt-1 font-semibold">{v.client.name || "Your client"}</p>
          {v.client.email && <p className="text-sm text-stone-600">{v.client.email}</p>}
          <p className="mt-2 text-sm text-stone-600">
            {v.project.name}
            {v.project.location ? ` · ${v.project.location}` : ""}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:justify-self-end">
          <dt className="text-stone-500">Invoice date</dt>
          <dd className="text-right font-medium">{formatDate(v.issueDate)}</dd>
          <dt className="text-stone-500">Due date</dt>
          <dd className="text-right font-medium">{v.dueDate ? formatDate(v.dueDate) : "On receipt"}</dd>
        </dl>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
            <th className="py-2 font-semibold">Description</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {v.lines.map((l, i) => (
            <tr key={i} className="border-b border-stone-100">
              <td className="py-3 pr-4 align-top">{l.description}</td>
              <td className="whitespace-nowrap py-3 text-right align-top tabular-nums">{formatMoney(l.amount, v.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between gap-6">
          <dt className="text-stone-500">Subtotal</dt>
          <dd className="tabular-nums">{formatMoney(v.subtotal, v.currency)}</dd>
        </div>
        {v.taxRate !== null && (
          <div className="flex justify-between gap-6">
            <dt className="text-stone-500">
              {v.taxLabel || "Tax"} ({v.taxRate}%)
            </dt>
            <dd className="tabular-nums">{formatMoney(v.taxAmount, v.currency)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-6 rounded-lg bg-amber-50 px-3 py-2 text-base font-bold">
          <dt>Total due</dt>
          <dd className="tabular-nums">{formatMoney(v.total, v.currency)}</dd>
        </div>
      </dl>

      {(v.company.paymentInstructions || v.note) && (
        <div className="mt-8 grid gap-6 border-t border-stone-200 pt-6 sm:grid-cols-2">
          {v.company.paymentInstructions && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">How to pay</p>
              <p className="mt-1 whitespace-pre-line text-sm">{v.company.paymentInstructions}</p>
            </div>
          )}
          {v.note && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Note</p>
              <p className="mt-1 whitespace-pre-line text-sm">{v.note}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
