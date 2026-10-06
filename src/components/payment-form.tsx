"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/login/actions";
import { sideLabel, type PaymentSide } from "@/lib/payments";
import { button, inputClass } from "@/lib/ui";

export type PaymentFormValues = {
  amount: string;
  payment_date: string;
  reference: string;
  note: string;
};

export function PaymentForm({
  action,
  projectId,
  draftId,
  initial,
  today,
  mode,
  side,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  projectId: string;
  // Present when creating, so a double tap can never record the payment twice.
  draftId?: string;
  initial: PaymentFormValues;
  today: string;
  mode: "create" | "edit";
  // Who is recording: the wording changes ("received" vs "paid").
  side: PaymentSide;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // After a failed save, show what was just submitted rather than the original values.
  const v = (key: keyof PaymentFormValues) => state.values?.[key] ?? initial[key];
  const received = side === "contractor";
  const otherParty = sideLabel[received ? "client" : "contractor"].toLowerCase();

  return (
    <form action={formAction} className="space-y-5">
      {draftId && <input type="hidden" name="id" value={draftId} />}

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {received ? "Amount received (PKR)" : "Amount you paid (PKR)"}
          </span>
          <input
            name="amount"
            inputMode="numeric"
            required
            defaultValue={v("amount")}
            placeholder="5,000,000"
            className={`${inputClass} text-lg font-semibold`}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            {received ? "Date received" : "Date paid"}
          </span>
          <input
            type="date"
            name="payment_date"
            required
            max={today}
            defaultValue={v("payment_date")}
            className={inputClass}
          />
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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={`/dashboard/projects/${projectId}/payments`} className={button("secondary")}>
          Cancel
        </Link>
        <button type="submit" disabled={pending} className={button("primary")}>
          {pending ? "Saving…" : mode === "create" ? "Record payment" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
