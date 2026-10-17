import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Paperclip, Pencil, Receipt } from "lucide-react";
import { LinkPending } from "@/components/link-pending";
import { DeletePaymentButton, PaymentResponse } from "@/components/payment-controls";
import { PaymentReminderButton } from "@/components/payment-reminder-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { formatDate, formatMoney, formatTimestamp } from "@/lib/format";
import { sideLabel, type PaymentItem, type PaymentSide } from "@/lib/payments";

const amountTone = {
  confirmed: "text-success",
  pending: "text-foreground",
  disputed: "text-danger",
} as const;

// One look at the row tells you where the payment stands: the round icon, the label under the
// amount, and the tint of the strip along the bottom all follow its status.
const look = {
  confirmed: { icon: CheckCircle2, circle: "bg-success-soft text-success", pill: "bg-success-soft text-success", label: "Confirmed" },
  pending: { icon: Clock, circle: "bg-primary-soft text-primary-hover", pill: "bg-primary-soft text-primary-hover", label: "Awaiting confirmation" },
  disputed: { icon: AlertTriangle, circle: "bg-danger-soft text-danger", pill: "bg-danger-soft text-danger", label: "Disputed" },
} as const;

export function PaymentCard({
  payment: p,
  projectId,
  currency,
  timeZone,
  viewerId,
  side,
  nudgeHref,
  sendReminders = false,
  forLabel = null,
  invoiceLabel = null,
}: {
  payment: PaymentItem;
  projectId: string;
  currency: string;
  timeZone: string;
  viewerId: string | undefined;
  // Which side the viewer is on; null for site staff, who can only look.
  side: PaymentSide | null;
  // WhatsApp link that reminds the other side to confirm (only when this person is waiting on them).
  nudgeHref?: string | null;
  // The contractor can send the reminder from the app (instead of opening WhatsApp by hand).
  sendReminders?: boolean;
  // The scheduled instalment this payment settles, when it says so.
  forLabel?: string | null;
  // The invoice it is for ("INV-0003"), when it says so and this person can see invoices.
  invoiceLabel?: string | null;
}) {
  const isRecorder = p.createdBy === viewerId;
  const otherSide: PaymentSide = p.side === "contractor" ? "client" : "contractor";
  // Only the opposite side may respond, and only while it's waiting.
  const canRespond = p.status === "pending" && side === otherSide;
  // The recorder can fix or remove it until the other side has confirmed.
  const canEdit = isRecorder && p.status !== "confirmed" && side === p.side;
  const { icon: StatusIcon, circle, pill, label } = look[p.status];
  const recordedBy = p.createdByName || sideLabel[p.side];
  const responder = p.respondedByName || sideLabel[otherSide];

  const actions = canEdit && (
    <div className="flex items-center gap-1">
      <Link
        href={`/dashboard/projects/${projectId}/payments/${p.id}/edit`}
        aria-label="Edit payment"
        title="Edit payment"
        className="relative flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
      >
        <Pencil className="size-4" aria-hidden />
        <LinkPending className="absolute size-4 rounded-full bg-surface" />
      </Link>
      <DeletePaymentButton projectId={projectId} paymentId={p.id} label={`${formatMoney(p.amount, currency)} on ${formatDate(p.date)}`} />
    </div>
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-start gap-3 p-4 sm:gap-4 sm:px-5 sm:py-4">
        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full sm:size-10 ${circle}`}>
          <StatusIcon className="size-4 sm:size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="font-semibold">{p.reference || (p.side === "contractor" ? "Payment received" : "Payment made")}</p>
            {forLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium">
                <CalendarClock className="size-3.5 text-muted" aria-hidden /> {forLabel}
              </span>
            )}
            {invoiceLabel && p.invoiceId && (
              <Link
                href={`/dashboard/projects/${projectId}/invoices/${p.invoiceId}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium tabular-nums transition-colors hover:bg-line"
              >
                <Receipt className="size-3.5 text-muted" aria-hidden /> {invoiceLabel}
              </Link>
            )}
          </div>

          <p className="mt-0.5 text-sm text-muted">
            {formatDate(p.date)}
            <span aria-hidden> · </span>
            Recorded by {recordedBy} ({sideLabel[p.side].toLowerCase()})
            {p.edited && <span className="italic"> · Edited</span>}
          </p>

          {p.status === "confirmed" && (
            <p className="mt-1 text-sm text-success">
              Confirmed by {responder} on {formatTimestamp(p.respondedAt, timeZone)}
            </p>
          )}

          {p.note && <p className="mt-2 text-sm leading-relaxed">{p.note}</p>}

          {p.receiptUrl && (
            <a
              href={p.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 py-1 pl-1 pr-3 text-sm font-medium transition-colors hover:bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL */}
              <img src={p.receiptUrl} alt="" loading="lazy" className="size-8 rounded-md object-cover" />
              <Paperclip className="size-3.5 text-muted" aria-hidden /> Receipt
            </a>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <p className={`text-lg font-bold tabular-nums sm:text-xl ${amountTone[p.status]}`}>{formatMoney(p.amount, currency)}</p>
          <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${pill}`}>{label}</span>
        </div>
      </div>

      {p.status === "pending" && (
        <div
          className={`flex gap-3 border-t border-line bg-primary-soft/40 px-4 py-3 sm:px-5 ${
            canRespond ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between"
          }`}
        >
          <p className="text-sm font-medium text-primary-hover">
            {canRespond
              ? `${recordedBy} recorded this payment. Is it correct?`
              : `Waiting for the ${sideLabel[otherSide].toLowerCase()} to confirm.`}
          </p>
          {canRespond && <PaymentResponse projectId={projectId} paymentId={p.id} />}
          {!canRespond && (
            <div className="flex flex-wrap items-start gap-2">
              {nudgeHref &&
                (sendReminders && side === "contractor" ? (
                  <PaymentReminderButton projectId={projectId} paymentId={p.id} manualHref={nudgeHref} />
                ) : (
                  <WhatsAppButton href={nudgeHref}>Remind the {sideLabel[otherSide].toLowerCase()} on WhatsApp</WhatsAppButton>
                ))}
              {actions}
            </div>
          )}
        </div>
      )}

      {p.status === "disputed" && (
        <div className="flex flex-col gap-3 border-t border-line bg-danger-soft/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="space-y-0.5 text-sm">
            <p className="font-medium text-danger">
              Disputed by {responder} on {formatTimestamp(p.respondedAt, timeZone)}
            </p>
            {p.disputeReason && <p className="italic text-muted">&ldquo;{p.disputeReason}&rdquo;</p>}
            {canEdit && <p className="text-muted">Edit the payment to send it back for confirmation, or delete it.</p>}
          </div>
          {actions}
        </div>
      )}
    </article>
  );
}
