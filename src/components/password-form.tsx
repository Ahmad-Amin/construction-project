"use client";

import { useActionState, useState } from "react";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import type { FormState } from "@/app/login/actions";
import { button, inputClass } from "@/lib/ui";

function Rule({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-xs ${met ? "text-success" : "text-muted"}`}>
      {met ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
      {children}
    </li>
  );
}

// Change-password form with a show/hide toggle and live feedback on the rules.
export function PasswordForm({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Keyed on the success message so the fields clear after a save, but keep what
  // was typed after a failed one.
  return <PasswordFields key={state.values?.at ?? "idle"} state={state} formAction={formAction} pending={pending} />;
}

function PasswordFields({
  state,
  formAction,
  pending,
}: {
  state: FormState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);

  const longEnough = password.length >= 8;
  const matches = confirm.length > 0 && password === confirm;

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">New password</span>
        <span className="relative block">
          <input
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Confirm new password</span>
        <input
          name="confirm"
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </label>

      <ul className="space-y-1">
        <Rule met={longEnough}>At least 8 characters</Rule>
        <Rule met={matches}>Both passwords match</Rule>
      </ul>

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

      <button type="submit" disabled={pending || !longEnough || !matches} className={button("primary")}>
        {pending ? "Please wait…" : "Change password"}
      </button>
    </form>
  );
}
