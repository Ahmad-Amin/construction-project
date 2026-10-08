"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { sendPaymentReminder, type ReminderResult } from "@/app/dashboard/projects/[id]/payments/actions";
import { button } from "@/lib/ui";

// "Remind the homeowner": sends the reminder from the app (WhatsApp, email and the bell). When
// WhatsApp can't be used for this homeowner it says why and offers the old way: open WhatsApp
// and send the message yourself.
export function PaymentReminderButton({
  projectId,
  paymentId,
  manualHref,
}: {
  projectId: string;
  paymentId: string;
  manualHref: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReminderResult | null>(null);

  function send() {
    setResult(null);
    startTransition(async () => setResult(await sendPaymentReminder(projectId, paymentId)));
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={send} disabled={pending} className={button("secondary", "sm")}>
        <MessageCircle className="size-4" aria-hidden /> {pending ? "Sending…" : "Remind the homeowner"}
      </button>
      {result && (
        <p role="status" className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>
          {result.message}
        </p>
      )}
      {result?.offerManual && (
        <a href={manualHref} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium underline underline-offset-4">
          Send it from your own WhatsApp instead
        </a>
      )}
    </div>
  );
}
