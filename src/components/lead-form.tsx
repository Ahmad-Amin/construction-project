"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/app/login/actions";
import { AmountInput } from "@/components/amount-input";
import { DateField } from "@/components/date-field";
import { PhoneField } from "@/components/phone-input";
import { CancelLink, useSheetBusy } from "@/components/sheet-lock";
import { followUpChoices, LEAD_SOURCES, WORK_TYPES, type LeadStage } from "@/lib/leads";
import { button, inputClass } from "@/lib/ui";

export type LeadFormValues = {
  name: string;
  phone: string;
  email: string;
  stage_id: string;
  work_type: string;
  size: string;
  location: string;
  budget: string;
  source: string;
  notes: string;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

// Adding a lead takes a name (and usually a phone number); everything else can wait. Editing shows every field.
export function LeadForm({
  action,
  mode,
  initial,
  stages,
  currency,
  phoneCountry,
  today,
  cancelHref,
  onDone,
  sheet = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  mode: "create" | "edit";
  initial: LeadFormValues;
  stages: LeadStage[];
  currency: string;
  phoneCountry: string;
  // The company's today (yyyy-mm-dd), for the follow-up choices.
  today: string;
  // Adding: Cancel goes back to the board. Editing (inside the lead's panel): Cancel and a successful save call onDone.
  cancelHref?: string;
  onDone?: () => void;
  sheet?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  useSheetBusy(pending);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (state.message) done.current?.();
  }, [state]);
  const v = (key: keyof LeadFormValues) => state.values?.[key] ?? initial[key];
  const [followUp, setFollowUp] = useState(state.values?.follow_up_on ?? "");
  const hasDetails = mode === "edit" || !!(state.values && (state.values.work_type || state.values.location || state.values.budget || state.values.notes));

  return (
    <form action={formAction} className={sheet ? "flex flex-1 flex-col gap-4" : "space-y-4"}>
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <Field label="Name">
          <input name="name" required maxLength={120} defaultValue={v("name")} placeholder="Hassan Ahmad" className={inputClass} autoFocus={mode === "create"} />
        </Field>
        <Field label="Phone" hint="Optional. For one-tap WhatsApp and calls.">
          {/* Keyed so a failed save shows what was typed. */}
          <PhoneField key={v("phone")} name="phone" defaultValue={v("phone")} defaultCountry={phoneCountry.toLowerCase()} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" hint="Optional.">
            <input name="email" type="email" maxLength={254} defaultValue={v("email")} className={inputClass} />
          </Field>
          <Field label="Stage">
            <select name="stage_id" defaultValue={v("stage_id")} className={inputClass}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <details open={hasDetails} className="group rounded-2xl border border-line bg-surface [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold sm:px-5">
          More details
          <span className="text-xs font-medium text-muted group-open:hidden">Type of work, size, budget, source, notes</span>
        </summary>
        <div className="space-y-4 border-t border-line p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type of work">
              <select name="work_type" defaultValue={v("work_type")} className={inputClass}>
                <option value="">Not sure yet</option>
                {WORK_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Size">
              <input name="size" maxLength={60} defaultValue={v("size")} placeholder="10 marla, 2,500 sq ft" className={inputClass} />
            </Field>
          </div>
          <Field label="Location">
            <input name="location" maxLength={200} defaultValue={v("location")} placeholder="DHA Phase 6, Lahore" className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Rough budget (${currency})`}>
              <AmountInput name="budget" defaultValue={v("budget")} placeholder="20,000,000" />
            </Field>
            <Field label="Where they found you">
              <select name="source" defaultValue={v("source")} className={inputClass}>
                <option value="">Not sure</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea name="notes" rows={3} maxLength={2000} defaultValue={v("notes")} placeholder="What they want, when they want to start" className={`${inputClass} resize-y`} />
          </Field>
        </div>
      </details>

      {mode === "create" && (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <p className="text-sm font-medium">
            Follow up <span className="font-normal text-muted">(optional)</span>
          </p>
          <div role="group" aria-label="When to follow up" className="flex flex-wrap gap-1.5">
            {followUpChoices(today).map((c) => (
              <button
                key={c.label}
                type="button"
                aria-pressed={followUp === c.day}
                onClick={() => setFollowUp(followUp === c.day ? "" : c.day)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  followUp === c.day ? "border-primary bg-primary-soft text-foreground" : "border-line text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <DateField name="follow_up_on" value={followUp} onValueChange={setFollowUp} min={today} today={today} placeholder="Or pick a day" />
            <input name="follow_up_note" maxLength={200} defaultValue={state.values?.follow_up_note ?? ""} placeholder="What to do then, like 'Send the quote'" className={inputClass} />
          </div>
        </section>
      )}

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
        {onDone ? (
          <button type="button" onClick={onDone} disabled={pending} className={button("secondary")}>
            Cancel
          </button>
        ) : (
          <CancelLink href={cancelHref ?? "/dashboard/leads"} busy={pending} />
        )}
        <button type="submit" disabled={pending} className={button("primary")}>
          {pending ? "Saving…" : mode === "create" ? "Add lead" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
