"use client";

import { useActionState, useState } from "react";
import { Info } from "lucide-react";
import type { FormState } from "@/app/login/actions";
import { AmountInput } from "@/components/amount-input";
import { DateField } from "@/components/date-field";
import { PaymentReceiptField } from "@/components/payment-receipt-field";
import type { InvoiceOption } from "@/lib/invoices";
import { sideLabel, type PaymentSide } from "@/lib/payments";
import { CancelLink, useSheetBusy } from "@/components/sheet-lock";
import { button, inputClass } from "@/lib/ui";

export type PaymentFormValues = {
  amount: string;
  payment_date: string;
  reference: string;
  note: string;
  // The scheduled instalment this payment settles; empty when it isn't tied to one.
  schedule_item_id: string;
  // The invoice this payment is for; empty when it isn't for one.
  invoice_id: string;
};

export function PaymentForm({
  action,
  projectId,
  currency,
  draftId,
  paymentId,
  receipt,
  initial,
  today,
  mode,
  side,
  scheduleOptions = [],
  invoiceOptions = [],
  fromInvoice = false,
  sheet = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  projectId: string;
  currency: string;
  // Present when creating, so a double tap can never record the payment twice.
  draftId?: string;
  // Present when editing: the payment being changed.
  paymentId?: string;
  // The receipt photo already attached (when editing).
  receipt?: { path: string; url: string | null } | null;
  initial: PaymentFormValues;
  today: string;
  mode: "create" | "edit";
  // Who is recording: the wording changes ("received" vs "paid").
  side: PaymentSide;
  // Instalments from the payment schedule that this payment could settle.
  scheduleOptions?: { id: string; label: string }[];
  // Sent invoices this payment could be for, each with the amount a payment for it must be.
  invoiceOptions?: InvoiceOption[];
  // Opened from an invoice's page: saving and cancelling go back there.
  fromInvoice?: boolean;
  // Shown in the slide-over panel: the buttons stay in view along the bottom while the form scrolls.
  sheet?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [uploading, setUploading] = useState(false);
  useSheetBusy(pending || uploading);
  // After a failed save, show what was just submitted rather than the original values.
  const v = (key: keyof PaymentFormValues) => state.values?.[key] ?? initial[key];
  // A payment for an invoice pays what is left on it, so picking one sets the amount and locks it.
  const [invoiceId, setInvoiceId] = useState(() => v("invoice_id"));
  const [amount, setAmount] = useState(() => v("amount"));
  const lockedTo = invoiceOptions.find((o) => o.id === invoiceId)?.amount ?? null;
  const received = side === "contractor";
  const otherParty = sideLabel[received ? "client" : "contractor"].toLowerCase();

  return (
    <form
      action={formAction}
      // React clears a form once its action has run. A successful save leaves the page anyway; after a failed one, keep
      // what was entered, so the invoice choice stays in step with the amount it locked.
      onReset={(e) => e.preventDefault()}
      className={sheet ? "flex flex-1 flex-col gap-4" : "space-y-4"}
    >
      {draftId && <input type="hidden" name="id" value={draftId} />}
      {fromInvoice && <input type="hidden" name="back" value="invoice" />}

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        {invoiceOptions.length > 0 && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Invoice</span>
            <select
              name="invoice_id"
              value={invoiceId}
              onChange={(e) => {
                setInvoiceId(e.target.value);
                const chosen = invoiceOptions.find((o) => o.id === e.target.value);
                if (chosen?.amount != null) setAmount(String(chosen.amount));
              }}
              className={inputClass}
            >
              <option value="">Not for an invoice</option>
              {invoiceOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">Optional. A payment for an invoice pays all of it; once confirmed, the invoice is paid.</span>
          </label>
        )}

        {scheduleOptions.length > 0 && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">What is this payment for?</span>
            <select name="schedule_item_id" defaultValue={v("schedule_item_id")} className={inputClass}>
              <option value="">Not part of the payment schedule</option>
              {scheduleOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">Optional. Once confirmed, it counts toward that instalment.</span>
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              {received ? `Amount received (${currency})` : `Amount you paid (${currency})`}
            </span>
            <AmountInput
              name="amount"
              required
              value={lockedTo !== null ? String(lockedTo) : amount}
              onValueChange={setAmount}
              disabled={lockedTo !== null}
              placeholder="5,000,000"
              className="font-semibold disabled:cursor-not-allowed disabled:opacity-70"
            />
            {lockedTo !== null && <span className="mt-1 block text-xs text-muted">Set by the invoice: what is left to pay on it.</span>}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{received ? "Date received" : "Date paid"}</span>
            <DateField name="payment_date" required max={today} today={today} defaultValue={v("payment_date")} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Reference</span>
          <input
            name="reference"
            maxLength={120}
            defaultValue={v("reference")}
            placeholder="Bank transfer, ref 4521"
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-muted">Optional. How it was paid, or a cheque or transfer number.</span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Note</span>
          <input
            name="note"
            maxLength={200}
            defaultValue={v("note")}
            placeholder="Second instalment, grey structure complete"
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-muted">Optional. The {otherParty} can see this.</span>
        </label>

        <PaymentReceiptField
          projectId={projectId}
          paymentId={(draftId ?? paymentId)!}
          initialPath={receipt?.path ?? null}
          initialUrl={receipt?.url ?? null}
          onBusyChange={setUploading}
        />
      </section>

      <p className="flex items-start gap-2 px-1 text-sm text-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        The {otherParty} will be asked to confirm this payment. It counts toward the total once they do.
      </p>

      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div
        className={`flex justify-end gap-2 ${
          sheet
            ? "sticky bottom-0 z-10 -mx-5 mt-auto border-t border-line bg-background/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-8 sm:px-8"
            : "pt-1"
        }`}
      >
        <CancelLink
          href={fromInvoice && initial.invoice_id ? `/dashboard/projects/${projectId}/invoices/${initial.invoice_id}` : `/dashboard/projects/${projectId}/payments`}
          busy={pending || uploading}
        />
        <button type="submit" disabled={pending || uploading} className={button("primary")}>
          {uploading ? "Uploading receipt…" : pending ? "Saving…" : mode === "create" ? "Record payment" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
