"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/login/actions";
import { button, inputClass } from "@/lib/ui";

type Field = {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  readOnly?: boolean;
  // Turns the field into a drop-down.
  options?: { value: string; label: string }[];
  hint?: string;
};

export function AuthForm({
  action,
  fields,
  submitLabel,
  variant = "primary",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="mb-1.5 block text-sm font-medium">{f.label}</span>
          {f.options ? (
            <select name={f.name} defaultValue={f.defaultValue} required className={inputClass}>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={f.name}
              type={f.type ?? "text"}
              autoComplete={f.autoComplete}
              defaultValue={f.defaultValue}
              readOnly={f.readOnly}
              required={!f.readOnly}
              className={`${inputClass} ${f.readOnly ? "opacity-70" : ""}`}
            />
          )}
          {f.hint && <span className="mt-1.5 block text-xs text-muted">{f.hint}</span>}
        </label>
      ))}

      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${button(variant)} w-full`}
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
