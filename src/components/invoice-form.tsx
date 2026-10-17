"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { saveInvoice } from "@/app/dashboard/projects/[id]/invoices/actions";
import { DateField } from "@/components/date-field";
import { formatMoney } from "@/lib/format";
import { MAX_LINES, invoiceTotals } from "@/lib/invoices";
import { button, inputClass } from "@/lib/ui";

type Line = { key: string; description: string; amount: string };

// Keys only need to be unique on this page (and crypto.randomUUID is missing on plain-http test addresses).
const newLine = (description = "", amount = ""): Line => ({ key: Math.random().toString(36).slice(2), description, amount });

export type InvoiceFormInitial = {
  issueDate: string;
  dueDate: string | null;
  lines: { description: string; amount: number }[];
  taxLabel: string;
  taxRate: number | null;
  note: string;
  scheduleItemId: string | null;
};

// An instalment from the payment schedule that can be turned into a line in one tap.
export type ScheduleChoice = { id: string; title: string; amount: number; left: number };

const digits = (value: string) => value.replace(/[^\d]/g, "").slice(0, 13);

export function InvoiceForm({
  projectId,
  invoiceId,
  initial,
  currency,
  today,
  schedule,
  paymentInstructions,
  editing,
}: {
  projectId: string;
  // Made on the server for a new invoice, so saving twice never creates two.
  invoiceId: string;
  initial: InvoiceFormInitial;
  currency: string;
  today: string;
  schedule: ScheduleChoice[];
  paymentInstructions: string;
  editing: boolean;
}) {
  const router = useRouter();

  const [issueDate, setIssueDate] = useState(initial.issueDate);
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    initial.lines.length ? initial.lines.map((l) => newLine(l.description, String(l.amount))) : [newLine()],
  );
  const [taxOn, setTaxOn] = useState(initial.taxRate !== null);
  const [taxLabel, setTaxLabel] = useState(initial.taxLabel || "");
  const [taxRate, setTaxRate] = useState(initial.taxRate !== null ? String(initial.taxRate) : "");
  const [note, setNote] = useState(initial.note);
  const [scheduleItemId, setScheduleItemId] = useState<string | null>(initial.scheduleItemId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rate = taxOn && taxRate.trim() !== "" ? Number(taxRate) : null;
  const totals = invoiceTotals(
    lines.map((l) => ({ description: l.description, amount: Number(l.amount || 0) })),
    rate !== null && Number.isFinite(rate) ? rate : null,
  );

  const setLine = (key: string, patch: Partial<Line>) => setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function addFromSchedule(id: string) {
    const item = schedule.find((s) => s.id === id);
    if (!item) return;
    const amount = String(item.left > 0 ? item.left : item.amount);
    setLines((all) => {
      // Fill the first empty line if there is one, so the form doesn't start with a blank row.
      const empty = all.find((l) => !l.description.trim() && !l.amount);
      if (empty) return all.map((l) => (l.key === empty.key ? { ...l, description: item.title, amount } : l));
      return [...all, newLine(item.title, amount)];
    });
    if (!scheduleItemId) setScheduleItemId(item.id);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    const filled = lines.filter((l) => l.description.trim() || l.amount);
    if (filled.length === 0) return setError("Please add at least one line.");
    if (filled.some((l) => !l.description.trim())) return setError("Each line needs a description.");
    if (filled.some((l) => !Number(l.amount))) return setError("Each line needs an amount above zero.");
    if (taxOn && (rate === null || !Number.isFinite(rate) || rate <= 0 || rate > 100)) {
      return setError("Please enter a tax rate between 0 and 100, or switch tax off.");
    }
    if (dueDate && dueDate < issueDate) return setError("The due date can't be before the invoice date.");

    startTransition(async () => {
      const result = await saveInvoice(projectId, invoiceId, {
        issueDate,
        dueDate: dueDate || null,
        lines: filled.map((l) => ({ description: l.description.trim(), amount: Number(l.amount) })),
        taxLabel: taxOn ? taxLabel.trim() : "",
        taxRate: taxOn ? rate : null,
        note,
        scheduleItemId,
      });
      if (result.error) return setError(result.error);
      router.push(`/dashboard/projects/${projectId}/invoices/${invoiceId}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Invoice date</span>
          <DateField name="issue_date" value={issueDate} onValueChange={setIssueDate} today={today} required />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Due date <span className="font-normal text-muted">(optional)</span>
          </span>
          <DateField name="due_date" value={dueDate} onValueChange={setDueDate} min={issueDate} today={today} placeholder="No due date" />
        </label>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">What you are charging for</h2>
          {schedule.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <CalendarClock className="size-4 text-muted" aria-hidden />
              <span className="sr-only">Add a line from the payment schedule</span>
              <select
                value=""
                onChange={(e) => addFromSchedule(e.target.value)}
                className={`${inputClass} w-auto py-1.5 text-sm`}
              >
                <option value="">Add from payment schedule…</option>
                {schedule.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} · {formatMoney(s.left > 0 ? s.left : s.amount, currency)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="space-y-2">
          <div className="hidden grid-cols-[minmax(0,1fr)_11rem_2.25rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted sm:grid">
            <span>Description</span>
            <span>Amount ({currency})</span>
            <span />
          </div>
          {lines.map((l, i) => (
            <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_2.25rem] gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_2.25rem]">
              <input
                value={l.description}
                onChange={(e) => setLine(l.key, { description: e.target.value })}
                maxLength={200}
                placeholder={i === 0 ? "Foundation complete" : "Description"}
                aria-label={`Line ${i + 1} description`}
                className={inputClass}
              />
              <input
                value={l.amount ? Number(l.amount).toLocaleString("en-US") : ""}
                onChange={(e) => setLine(l.key, { amount: digits(e.target.value) })}
                inputMode="numeric"
                placeholder="0"
                aria-label={`Line ${i + 1} amount`}
                className={`${inputClass} order-3 col-span-1 text-right tabular-nums sm:order-none`}
              />
              <button
                type="button"
                onClick={() => setLines((all) => (all.length === 1 ? [newLine()] : all.filter((x) => x.key !== l.key)))}
                aria-label={`Remove line ${i + 1}`}
                className="flex size-9 items-center justify-center self-center rounded-lg text-muted hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
        {lines.length < MAX_LINES && (
          <button type="button" onClick={() => setLines((all) => [...all, newLine()])} className={`${button("secondary", "sm")} mt-3`}>
            <Plus className="size-4" aria-hidden /> Add line
          </button>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={taxOn} onChange={(e) => setTaxOn(e.target.checked)} className="size-4 accent-primary" />
            Add a tax line
          </label>
          {taxOn && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Tax name</span>
                <input value={taxLabel} onChange={(e) => setTaxLabel(e.target.value)} maxLength={40} placeholder="Sales tax" className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Rate (%)</span>
                <input
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))}
                  inputMode="decimal"
                  placeholder="16"
                  className={inputClass}
                />
              </label>
              <p className="text-xs text-muted sm:col-span-2">
                You are responsible for using the right tax and rate for your business. BuildPeek only adds it up.
              </p>
            </div>
          )}
        </div>

        <dl className="ml-auto mt-5 max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(totals.subtotal, currency)}</dd>
          </div>
          {taxOn && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">
                {taxLabel.trim() || "Tax"}
                {rate ? ` (${rate}%)` : ""}
              </dt>
              <dd className="tabular-nums">{formatMoney(totals.tax, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-line pt-1.5 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(totals.total, currency)}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Note <span className="font-normal text-muted">(optional)</span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Thank you for your business."
            className={`${inputClass} resize-y`}
          />
        </label>
        <div>
          <p className="mb-1.5 text-sm font-medium">Payment instructions</p>
          {paymentInstructions ? (
            <p className="whitespace-pre-line rounded-xl bg-surface-2 px-4 py-3 text-sm">{paymentInstructions}</p>
          ) : (
            <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary-hover">
              Add your bank account or Easypaisa / JazzCash number in{" "}
              <Link href="/dashboard/settings#invoices" className="font-semibold underline underline-offset-2">
                Settings → Invoices
              </Link>{" "}
              and it is printed on every invoice.
            </p>
          )}
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Link href={editing ? `/dashboard/projects/${projectId}/invoices/${invoiceId}` : `/dashboard/projects/${projectId}/invoices`} className={button("secondary")}>
          Cancel
        </Link>
        <button type="submit" disabled={pending} className={button("primary")}>
          {pending ? "Saving…" : "Save and preview"}
        </button>
      </div>
    </form>
  );
}
