import { AlertTriangle, Banknote, Camera, CheckCircle2, Flag, Receipt, type LucideIcon } from "lucide-react";
import { PhotoGallery } from "@/components/photo-gallery";
import { expenseCategoryLabel } from "@/lib/expenses";
import { formatDate, formatPKR, formatRelativeDate, formatTime } from "@/lib/format";
import { sideLabel, type PaymentStatus } from "@/lib/payments";
import type { TimelineEvent } from "@/lib/timeline";

const statusBadge: Record<PaymentStatus, { label: string; style: string }> = {
  pending: { label: "Awaiting confirmation", style: "bg-primary-soft text-primary-hover" },
  confirmed: { label: "Confirmed", style: "bg-success-soft text-success" },
  disputed: { label: "Disputed", style: "bg-danger-soft text-danger" },
};

// One chronological feed, grouped by day. On a wide screen each day is a heading on the left with
// its events stacked beside it; on a phone the heading sits above. Every event says what it is,
// when, who did it, and the amount or details.
export function TimelineFeed({ events }: { events: TimelineEvent[] }) {
  const days: { date: string; items: TimelineEvent[] }[] = [];
  for (const e of events) {
    const last = days[days.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else days.push({ date: e.date, items: [e] });
  }

  return (
    <div className="space-y-8">
      {days.map((day) => (
        <section key={day.date} className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-6">
          <h2 className="text-sm font-semibold lg:sticky lg:top-20 lg:self-start lg:pt-3">
            {formatRelativeDate(day.date)}
            {formatRelativeDate(day.date) !== formatDate(day.date) && (
              <span className="ml-2 font-normal text-muted lg:ml-0 lg:block">{formatDate(day.date)}</span>
            )}
            <span className="mt-0.5 hidden text-xs font-normal text-muted lg:block">
              {day.items.length} {day.items.length === 1 ? "event" : "events"}
            </span>
          </h2>
          <ul className="min-w-0 space-y-2.5">
            {day.items.map((e) => (
              <li key={e.id}>
                <EventRow event={e} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// The shape every event shares: a round icon, a small label with the time and who did it, the
// content, and on the right the amount with its status.
function Row({
  icon: Icon,
  tone,
  label,
  time,
  by,
  amount,
  amountTone = "",
  pill,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  time: string;
  by?: string;
  amount?: number;
  amountTone?: string;
  pill?: { label: string; style: string };
  children: React.ReactNode;
}) {
  return (
    <article className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 sm:gap-4 sm:px-5">
      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full sm:size-10 ${tone}`}>
        <Icon className="size-4 sm:size-5" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">
          <span className="font-semibold uppercase tracking-wide">{label}</span>
          <span aria-hidden> · </span>
          {time}
          {by && (
            <>
              <span aria-hidden> · </span>
              {by}
            </>
          )}
        </p>
        <div className="mt-1">{children}</div>
      </div>

      {(amount !== undefined || pill) && (
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {amount !== undefined && <p className={`text-lg font-bold tabular-nums sm:text-xl ${amountTone}`}>{formatPKR(amount)}</p>}
          {pill && (
            <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${pill.style}`}>{pill.label}</span>
          )}
        </div>
      )}
    </article>
  );
}

function EventRow({ event: e }: { event: TimelineEvent }) {
  const time = formatTime(e.occurredAt);

  if (e.kind === "update") {
    return (
      <Row icon={Camera} tone="bg-primary-soft text-primary" label="Site update" time={time} by={e.actorName}>
        <p className="max-w-3xl whitespace-pre-line leading-relaxed">{e.update.text}</p>
        {e.update.milestone && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium">
            <Flag className="size-3" aria-hidden /> {e.update.milestone}
          </p>
        )}
        <PhotoGallery photos={e.update.photos} layout="row" />
      </Row>
    );
  }

  if (e.kind === "expense") {
    return (
      <Row
        icon={Receipt}
        tone="bg-surface-2 text-muted"
        label={`Expense · ${expenseCategoryLabel[e.category]}`}
        time={time}
        by={e.actorName}
        amount={e.amount}
      >
        <p className="font-medium">{e.title || expenseCategoryLabel[e.category]}</p>
      </Row>
    );
  }

  if (e.kind === "payment") {
    const badge = statusBadge[e.status];
    return (
      <Row
        icon={Banknote}
        tone="bg-success-soft text-success"
        label="Payment recorded"
        time={time}
        by={e.actorName ? `${e.actorName} (${sideLabel[e.side].toLowerCase()})` : undefined}
        amount={e.amount}
        pill={badge}
      >
        <p className="font-medium">{e.title || (e.side === "contractor" ? "Payment received" : "Payment made")}</p>
        {e.note && <p className="mt-0.5 text-sm text-muted">{e.note}</p>}
        <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold sm:hidden ${badge.style}`}>
          {badge.label}
        </span>
      </Row>
    );
  }

  // payment_response
  const disputed = e.status === "disputed";
  const recorder = sideLabel[e.side].toLowerCase();
  return (
    <Row
      icon={disputed ? AlertTriangle : CheckCircle2}
      tone={disputed ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}
      label={disputed ? "Payment disputed" : "Payment confirmed"}
      time={time}
      amount={e.amount}
      amountTone={disputed ? "text-danger" : ""}
    >
      <p>
        <span className="font-medium">{e.actorName || "The other party"}</span> {disputed ? "disputed" : "confirmed"} the{" "}
        {recorder}&apos;s payment.
      </p>
      {disputed && e.reason && <p className="mt-0.5 text-sm italic text-muted">&ldquo;{e.reason}&rdquo;</p>}
    </Row>
  );
}
