"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { FormState } from "@/app/login/actions";
import { DEFAULT_MILESTONES } from "@/lib/project";
import { button, inputClass } from "@/lib/ui";

export type ProjectFormValues = {
  name: string;
  location: string;
  start_date: string;
  expected_completion_date: string;
  status: string;
  budget: string;
  budget_visible: boolean;
  client_name: string;
  client_email: string;
  client_phone: string;
};

export const emptyProjectValues: ProjectFormValues = {
  name: "",
  location: "",
  start_date: "",
  expected_completion_date: "",
  status: "active",
  budget: "",
  budget_visible: false,
  client_name: "",
  client_email: "",
  client_phone: "",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function ProjectForm({
  action,
  mode,
  defaults,
  emailLocked = false,
  cancelHref,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  mode: "create" | "edit";
  defaults: ProjectFormValues;
  emailLocked?: boolean;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // After a failed save, show what was just submitted rather than the original defaults.
  const v = (key: keyof ProjectFormValues) => state.values?.[key] ?? String(defaults[key]);
  const visible = state.values ? state.values.budget_visible === "on" : defaults.budget_visible;
  const nextId = useRef(DEFAULT_MILESTONES.length);
  const [milestones, setMilestones] = useState(() =>
    DEFAULT_MILESTONES.map((name, id) => ({ id, name })),
  );

  return (
    <form action={formAction} className="space-y-5">
      <Section title="Project">
        <Field label="Project name">
          <input name="name" required defaultValue={v("name")} placeholder="Ahmed Residence" className={inputClass} />
        </Field>
        <Field label="Location">
          <input name="location" defaultValue={v("location")} placeholder="DHA Phase 6, Lahore" className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date">
            <input type="date" name="start_date" defaultValue={v("start_date")} className={inputClass} />
          </Field>
          <Field label="Expected completion" hint="Optional">
            <input
              type="date"
              name="expected_completion_date"
              defaultValue={v("expected_completion_date")}
              className={inputClass}
            />
          </Field>
        </div>
        {mode === "edit" && (
          <Field label="Status">
            <select name="status" defaultValue={v("status")} className={inputClass}>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
        )}
        <Field label="Budget (PKR)" hint="Optional. Whole rupees, like 35000000.">
          <input
            name="budget"
            inputMode="numeric"
            defaultValue={v("budget")}
            placeholder="35,000,000"
            className={inputClass}
          />
        </Field>
        {mode === "edit" && (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="budget_visible"
              defaultChecked={visible}
              className="mt-0.5 size-5 accent-primary"
            />
            <span>
              Show the budget to the client
              <span className="block text-xs text-muted">Off by default. The client never sees it unless you turn this on.</span>
            </span>
          </label>
        )}
      </Section>

      <Section title="Client">
        <Field label="Client name">
          <input name="client_name" required defaultValue={v("client_name")} placeholder="Ahmed Khan" className={inputClass} />
        </Field>
        <Field
          label="Client email"
          hint={emailLocked ? "This client has already signed in, so their email is fixed." : "They use this email to sign in."}
        >
          <input
            type="email"
            name="client_email"
            required={!emailLocked}
            disabled={emailLocked}
            defaultValue={v("client_email")}
            placeholder="ahmed@example.com"
            className={`${inputClass} disabled:opacity-60`}
          />
        </Field>
        <Field label="Client phone" hint="Optional. Used to share the invite on WhatsApp.">
          <input
            type="tel"
            name="client_phone"
            defaultValue={v("client_phone")}
            placeholder="0300 1234567"
            className={inputClass}
          />
        </Field>
      </Section>

      {mode === "create" && (
        <Section title="Milestones">
          <p className="-mt-2 text-sm text-muted">
            The main stages of the build. You can change these later.
          </p>
          <ul className="space-y-2">
            {milestones.map((m) => (
              <li key={m.id} className="flex gap-2">
                <input
                  name="milestone"
                  value={m.name}
                  onChange={(e) =>
                    setMilestones((list) =>
                      list.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  aria-label="Milestone name"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setMilestones((list) => list.filter((x) => x.id !== m.id))}
                  aria-label={`Remove ${m.name || "milestone"}`}
                  className="shrink-0 rounded-lg border border-line px-3 text-muted hover:bg-surface-2"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {milestones.length < 20 && (
            <button
              type="button"
              onClick={() => setMilestones((list) => [...list, { id: nextId.current++, name: "" }])}
              className={button("secondary", "sm")}
            >
              <Plus className="size-4" aria-hidden /> Add milestone
            </button>
          )}
        </Section>
      )}

      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={button("secondary")}>
          Cancel
        </Link>
        <button type="submit" disabled={pending} className={button("primary")}>
          {pending ? "Saving…" : mode === "create" ? "Create project" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
