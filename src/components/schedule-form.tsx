"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/login/actions";
import { AmountInput } from "@/components/amount-input";
import type { Stage } from "@/lib/payment-schedule";
import { button, inputClass } from "@/lib/ui";

export type ScheduleFormValues = { title: string; amount: string; milestone_id: string };

export function ScheduleForm({
  action,
  projectId,
  stages,
  initial,
  mode,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  projectId: string;
  stages: Stage[];
  initial: ScheduleFormValues;
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = (key: keyof ScheduleFormValues) => state.values?.[key] ?? initial[key];

  return (
    <form action={formAction} className="space-y-5">
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Name</span>
          <input
            name="title"
            required
            maxLength={80}
            defaultValue={v("title")}
            placeholder="Foundation instalment"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Amount (PKR)</span>
          <AmountInput name="amount" required defaultValue={v("amount")} placeholder="500,000" className="text-lg font-semibold" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">When is it due?</span>
          <select name="milestone_id" defaultValue={v("milestone_id")} className={inputClass}>
            <option value="">From the start of the work</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                When {s.name} is complete
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            It falls due as soon as that stage reaches 100%, and your client is told.
          </span>
        </label>
      </section>

      <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
        This is only a plan. No payment is created until one is recorded and confirmed on the Payments page.
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
          {pending ? "Saving…" : mode === "create" ? "Add to schedule" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
