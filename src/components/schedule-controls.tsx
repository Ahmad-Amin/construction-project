"use client";

import { useState, useTransition } from "react";
import { BellRing, Trash2 } from "lucide-react";
import {
  deleteScheduleItem,
  sendScheduleReminder,
  type ReminderResult,
} from "@/app/dashboard/projects/[id]/payments/actions";
import { Spinner } from "@/components/spinner";
import { useToast } from "@/components/toast";
import { button } from "@/lib/ui";

// "Request payment": tells the homeowner this instalment is due (the bell and email), and offers
// the same message ready to send from your own WhatsApp.
export function ScheduleReminderButton({
  projectId,
  itemId,
  manualHref,
}: {
  projectId: string;
  itemId: string;
  manualHref: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReminderResult | null>(null);
  const toast = useToast();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            const r = await sendScheduleReminder(projectId, itemId);
            setResult(r);
            if (r.ok) toast.success("Payment requested", r.message);
          });
        }}
        className={button("primary", "sm")}
      >
        {pending ? <Spinner /> : <BellRing className="size-4" aria-hidden />}
        {pending ? "Sending…" : "Request payment"}
      </button>
      {result && (
        <p role="status" className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>
          {result.message}
        </p>
      )}
      {result?.offerManual && (
        <a href={manualHref} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium underline underline-offset-4">
          Also send it from your own WhatsApp
        </a>
      )}
    </div>
  );
}

export function DeleteScheduleButton({
  projectId,
  itemId,
  title,
}: {
  projectId: string;
  itemId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        aria-label={`Remove ${title}`}
        title="Remove from the schedule"
        onClick={() => {
          if (!window.confirm(`Remove "${title}" from the payment schedule? Payments already recorded stay as they are.`)) return;
          startTransition(async () => {
            const result = await deleteScheduleItem(projectId, itemId);
            setError(result.error ?? null);
            if (!result.error) toast.success("Removed from the payment schedule");
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
