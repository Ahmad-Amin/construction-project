"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Eye, EyeOff } from "lucide-react";
import type { FormState } from "@/app/login/actions";
import { trackSignUp } from "@/lib/analytics";
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
  // A small status shown beside the label, like "Verified".
  badge?: { label: string; tone: "ok" | "warn" };
};

// A password box with a button to show what was typed. The value stays in the box either way;
// only how it is drawn changes.
function PasswordInput({
  name,
  autoComplete,
  defaultValue,
}: {
  name: string;
  autoComplete?: string;
  defaultValue?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        className={`${inputClass} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </span>
  );
}

export function AuthForm({
  action,
  fields,
  submitLabel,
  variant = "primary",
  columns = 1,
  autoWidthButton = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
  variant?: "primary" | "secondary";
  // Lay the fields out side by side (on wider screens). Used by the settings page.
  columns?: 1 | 2 | 3;
  // A button as wide as its label instead of the whole form (settings, where the form is wide).
  autoWidthButton?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  // A brand-new account was just created: tell Google Analytics once, with nothing about the person.
  useEffect(() => {
    if (state.signedUp) trackSignUp("email");
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className={columns === 1 ? "space-y-4" : columns === 2 ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium">
            {f.label}
            {f.badge && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  f.badge.tone === "ok" ? "bg-success-soft text-success" : "bg-primary-soft text-primary-hover"
                }`}
              >
                {f.badge.tone === "ok" ? (
                  <CheckCircle2 className="size-3.5" aria-hidden />
                ) : (
                  <CircleAlert className="size-3.5" aria-hidden />
                )}
                {f.badge.label}
              </span>
            )}
          </span>
          {f.options ? (
            <select name={f.name} defaultValue={f.defaultValue} required className={inputClass}>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "password" ? (
            <PasswordInput name={f.name} autoComplete={f.autoComplete} defaultValue={f.defaultValue} />
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
      </div>

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
        className={`${button(variant)} ${autoWidthButton ? "w-full sm:w-auto sm:min-w-32" : "w-full"}`}
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
