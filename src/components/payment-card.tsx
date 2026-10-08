import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Pencil, User } from "lucide-react";
import { DeletePaymentButton, PaymentResponse } from "@/components/payment-controls";
import { PaymentReminderButton } from "@/components/payment-reminder-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { formatDate, formatPKR, formatTimestamp } from "@/lib/format";
import { sideLabel, type PaymentItem, type PaymentSide } from "@/lib/payments";

const amountTone = {
  confirmed: "text-success",
  pending: "text-foreground",
  disputed: "text-danger",
} as const;

export function PaymentCard({
  payment: p,
  projectId,
  viewerId,
  side,
  nudgeHref,
  sendReminders = false,
}: {
  payment: PaymentItem;
  projectId: string;
  viewerId: string | undefined;
  // Which side the viewer is on; null for site staff, who can only look.
  side: PaymentSide | null;
  // WhatsApp link that reminds the other side to confirm (only when this person is waiting on them).
  nudgeHref?: string | null;
  // The contractor can send the reminder from the app (instead of opening WhatsApp by hand).
  sendReminders?: boolean;
}) {
  const isRecorder = p.createdBy === viewerId;
  const otherSide: PaymentSide = p.side === "contractor" ? "client" : "contractor";
  // Only the opposite side may respond, and only while it's waiting.
  const canRespond = p.status === "pending" && side === otherSide;
  // The recorder can fix or remove it until the other side has confirmed.
  const canEdit = isRecorder && p.status !== "confirmed" && side === p.side;

  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {p.reference || (p.side === "contractor" ? "Payment received" : "Payment made")}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {formatDate(p.date)}
            {p.edited && <span className="ml-2 italic">Edited</span>}
          </p>
        </div>
        <p className={`shrink-0 text-lg font-bold tabular-nums ${amountTone[p.status]}`}>
          {formatPKR(p.amount)}
        </p>
      </div>

      {p.note && <p className="mt-3 text-sm leading-relaxed">{p.note}</p>}

      <p className="mt-3 flex items-center gap-1 text-xs text-muted">
        <User className="size-3" aria-hidden />
        Recorded by {p.createdByName || sideLabel[p.side]} ({sideLabel[p.side].toLowerCase()})
      </p>

      <div className="mt-4 border-t border-line pt-4">
        {p.status === "confirmed" && (
          <p className="flex items-start gap-2 text-sm text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Confirmed by {p.respondedByName || sideLabel[otherSide]} on {formatTimestamp(p.respondedAt)}
            </span>
          </p>
        )}

        {p.status === "disputed" && (
          <div className="space-y-1 text-sm">
            <p className="flex items-start gap-2 font-medium text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Disputed by {p.respondedByName || sideLabel[otherSide]} on {formatTimestamp(p.respondedAt)}
              </span>
            </p>
            {p.disputeReason && <p className="pl-6 italic text-muted">&ldquo;{p.disputeReason}&rdquo;</p>}
            {canEdit && (
              <p className="pl-6 text-muted">
                Edit the payment to send it back for confirmation, or delete it.
              </p>
            )}
          </div>
        )}

        {p.status === "pending" && (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm text-primary-hover">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {canRespond
                  ? `${p.createdByName || sideLabel[p.side]} recorded this payment. Is it correct?`
                  : `Waiting for the ${sideLabel[otherSide].toLowerCase()} to confirm.`}
              </span>
            </p>
            {canRespond && <PaymentResponse projectId={projectId} paymentId={p.id} />}
            {!canRespond && nudgeHref && (sendReminders && side === "contractor" ? (
              <PaymentReminderButton projectId={projectId} paymentId={p.id} manualHref={nudgeHref} />
            ) : (
              <WhatsAppButton href={nudgeHref}>Remind the {sideLabel[otherSide].toLowerCase()} on WhatsApp</WhatsAppButton>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="mt-3 flex items-center justify-end gap-1">
            <Link
              href={`/dashboard/projects/${projectId}/payments/${p.id}/edit`}
              aria-label="Edit payment"
              title="Edit payment"
              className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <Pencil className="size-4" aria-hidden />
            </Link>
            <DeletePaymentButton
              projectId={projectId}
              paymentId={p.id}
              label={`${formatPKR(p.amount)} on ${formatDate(p.date)}`}
            />
          </div>
        )}
      </div>
    </article>
  );
}
