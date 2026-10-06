import { AlertTriangle, Banknote, Camera, CheckCircle2, Flag, Receipt, User } from "lucide-react";
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

// One chronological feed, grouped by day. Every event says what it is, when,
// who did it, and the amount or details.
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
        <section key={day.date}>
          <h2 className="mb-3 text-sm font-semibold">
            {formatRelativeDate(day.date)}
            {formatRelativeDate(day.date) !== formatDate(day.date) && (
              <span className="ml-2 font-normal text-muted">{formatDate(day.date)}</span>
            )}
          </h2>
          <ul className="relative space-y-3">
            <span aria-hidden className="absolute bottom-4 left-[17px] top-4 w-px bg-line" />
            {day.items.map((e) => (
              <li key={e.id} className="relative pl-12">
                <EventIcon event={e} />
                <EventCard event={e} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EventIcon({ event: e }: { event: TimelineEvent }) {
  let Icon = Camera;
  let tone = "bg-primary-soft text-primary";
  if (e.kind === "expense") Icon = Receipt;
  if (e.kind === "payment") {
    Icon = Banknote;
    tone = "bg-success-soft text-success";
  }
  if (e.kind === "payment_response") {
    const disputed = e.status === "disputed";
    Icon = disputed ? AlertTriangle : CheckCircle2;
    tone = disputed ? "bg-danger-soft text-danger" : "bg-success-soft text-success";
  }
  return (
    <span className={`absolute left-0 top-3 flex size-9 items-center justify-center rounded-full ring-4 ring-background ${tone}`}>
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

function Header({ label, time, amount }: { label: string; time: string; amount?: number }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label} <span className="font-normal normal-case tracking-normal">· {time}</span>
      </p>
      {amount !== undefined && <p className="shrink-0 text-lg font-bold tabular-nums">{formatPKR(amount)}</p>}
    </div>
  );
}

function By({ name, suffix }: { name: string; suffix?: string }) {
  if (!name) return null;
  return (
    <p className="mt-2 flex items-center gap-1 text-xs text-muted">
      <User className="size-3" aria-hidden /> {name}
      {suffix && ` ${suffix}`}
    </p>
  );
}

function EventCard({ event: e }: { event: TimelineEvent }) {
  const time = formatTime(e.occurredAt);
  const card = "rounded-2xl border border-line bg-surface p-4";

  if (e.kind === "update") {
    return (
      <article className={card}>
        <Header label="Site update" time={time} />
        <p className="mt-2 whitespace-pre-line leading-relaxed">{e.update.text}</p>
        {e.update.milestone && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium">
            <Flag className="size-3" aria-hidden /> {e.update.milestone}
          </p>
        )}
        <PhotoGallery photos={e.update.photos} />
        <By name={e.actorName} />
      </article>
    );
  }

  if (e.kind === "expense") {
    return (
      <article className={card}>
        <Header label={`Expense · ${expenseCategoryLabel[e.category]}`} time={time} amount={e.amount} />
        <p className="mt-2 font-medium">{e.title || expenseCategoryLabel[e.category]}</p>
        <By name={e.actorName} />
      </article>
    );
  }

  if (e.kind === "payment") {
    const badge = statusBadge[e.status];
    return (
      <article className={card}>
        <Header label="Payment recorded" time={time} amount={e.amount} />
        <p className="mt-2 font-medium">
          {e.title || (e.side === "contractor" ? "Payment received" : "Payment made")}
        </p>
        {e.note && <p className="mt-1 text-sm text-muted">{e.note}</p>}
        <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${badge.style}`}>
          {badge.label}
        </span>
        <By name={e.actorName} suffix={`(${sideLabel[e.side].toLowerCase()})`} />
      </article>
    );
  }

  // payment_response
  const disputed = e.status === "disputed";
  const recorder = sideLabel[e.side].toLowerCase();
  return (
    <article className={card}>
      <Header label={disputed ? "Payment disputed" : "Payment confirmed"} time={time} amount={e.amount} />
      <p className="mt-2 text-sm">
        <span className="font-medium">{e.actorName || "The other party"}</span>{" "}
        {disputed ? "disputed" : "confirmed"} the {recorder}&apos;s payment.
      </p>
      {disputed && e.reason && <p className="mt-1 text-sm italic text-muted">&ldquo;{e.reason}&rdquo;</p>}
    </article>
  );
}
