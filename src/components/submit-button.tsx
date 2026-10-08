"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/spinner";

// A submit button that shows it is working while its form's action runs. Put it inside a
// <form action={...}>. When a form has several buttons, `name` and `value` let only the one that
// was pressed show the spinner.
export function SubmitButton({
  children,
  pendingLabel,
  className,
  name,
  value,
  icon,
  ariaLabel,
  title,
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  title?: string;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && (name === undefined || data?.get(name) === value);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={mine || undefined}
      aria-label={ariaLabel}
      title={title}
      className={`${className ?? ""} ${pending && !mine ? "opacity-60" : ""}`}
    >
      {mine ? <Spinner /> : icon}
      {mine && pendingLabel ? pendingLabel : children}
    </button>
  );
}
