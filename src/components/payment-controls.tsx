"use client";

import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import {
  deletePayment,
  respondToPayment,
} from "@/app/dashboard/projects/[id]/payments/actions";
import { button, inputClass } from "@/lib/ui";

export function DeletePaymentButton({
  projectId,
  paymentId,
  label,
}: {
  projectId: string;
  paymentId: string;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        aria-label="Delete payment"
        title="Delete payment"
        onClick={() => {
          if (!window.confirm(`Delete the payment of ${label}? This can't be undone.`)) return;
          startTransition(async () => {
            const result = await deletePayment(projectId, paymentId);
            setError(result.error ?? null);
            if (!result.error) toast.success("Payment deleted");
          });
        }}
        className="flex size-9 items-center justify-center rounded-lg text-danger transition-colors hover:bg-surface-2 disabled:opacity-40"
      >
        {pending ? <Spinner /> : <Trash2 className="size-4" aria-hidden />}
      </button>
      {error && (
        <span role="alert" className="mt-1 block max-w-40 text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}

// The other side confirms a payment, or disputes it with a short reason.
export function PaymentResponse({
  projectId,
  paymentId,
}: {
  projectId: string;
  paymentId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  function respond(action: "confirm" | "dispute") {
    startTransition(async () => {
      const result = await respondToPayment(projectId, paymentId, action, reason);
      setError(result.error ?? null);
      if (!result.error) toast.success(action === "confirm" ? "Payment confirmed" : "Payment disputed", action === "confirm" ? undefined : "The other side has been told why.");
    });
  }

  if (disputing) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor={`reason-${paymentId}`}>
          What&apos;s not right about this payment?
        </label>
        <textarea
          id={`reason-${paymentId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="For example: I received PKR 4,000,000, not 5,000,000."
          className={inputClass}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={() => respond("dispute")}
            className={button("primary", "sm")}
          >
            {pending ? "Sending…" : "Send dispute"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setDisputing(false);
              setError(null);
            }}
            className={button("secondary", "sm")}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => respond("confirm")}
          className={button("primary", "sm")}
        >
          {pending ? <Spinner /> : <Check className="size-4" aria-hidden />} {pending ? "Confirming…" : "Confirm"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setDisputing(true)}
          className={button("secondary", "sm")}
        >
          Dispute
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
