"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/login/actions";
import { AmountInput } from "@/components/amount-input";
import { DateField } from "@/components/date-field";
import { PaymentReceiptField } from "@/components/payment-receipt-field";
import { sideLabel, type PaymentSide } from "@/lib/payments";
import { button, inputClass } from "@/lib/ui";

export type PaymentFormValues = {
  amount: string;
  payment_date: string;
  reference: string;
  note: string;
  // The scheduled instalment this payment settles; empty when it isn't tied to one.
  schedule_item_id: string;
};

export function PaymentForm({
  action,
  projectId,
  draftId,
  paymentId,
  receipt,
  initial,
  today,
  mode,
  side,
  scheduleOptions = [],
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  projectId: string;
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
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [uploading, setUploading] = useState(false);
  // After a failed save, show what was just submitted rather than the original values.
  const v = (key: keyof PaymentFormValues) => state.values?.[key] ?? initial[key];
  const received = side === "contractor";
  const otherParty = sideLabel[received ? "client" : "contractor"].toLowerCase();

  return (
    <form action={formAction} className="space-y-5">
      {draftId && <input type="hidden" name="id" value={draftId} />}

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
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

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {received ? "Amount received (PKR)" : "Amount you paid (PKR)"}
          </span>
          <AmountInput
            name="amount"
            required
            defaultValue={v("amount")}
            placeholder="5,000,000"
            className="text-lg font-semibold"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {received ? "Date received" : "Date paid"}
          </span>
          <DateField name="payment_date" required max={today} today={today} defaultValue={v("payment_date")} />
        </label>

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
      </section>

      <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
        The {otherParty} will be asked to confirm this payment. It counts toward the total once they do.
      </p>

      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <PaymentReceiptField
        projectId={projectId}
        paymentId={(draftId ?? paymentId)!}
        initialPath={receipt?.path ?? null}
        initialUrl={receipt?.url ?? null}
        onBusyChange={setUploading}
      />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={`/dashboard/projects/${projectId}/payments`} className={button("secondary")}>
          Cancel
        </Link>
        <button type="submit" disabled={pending || uploading} className={button("primary")}>
          {uploading ? "Uploading receipt…" : pending ? "Saving…" : mode === "create" ? "Record payment" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
