import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock, Pencil, Plus } from "lucide-react";
import { ScheduleCollapse } from "@/components/schedule-collapse";
import { DeleteScheduleButton, ScheduleReminderButton } from "@/components/schedule-controls";
import { formatPKR } from "@/lib/format";
import type { ScheduleItem, ScheduleStatus } from "@/lib/payment-schedule";
import { scheduleTotals } from "@/lib/payment-schedule";
import type { PaymentSide } from "@/lib/payments";
import { button } from "@/lib/ui";

const badge: Record<ScheduleStatus, { label: string; tone: string }> = {
  upcoming: { label: "Upcoming", tone: "bg-surface-2 text-muted" },
  due: { label: "Due now", tone: "bg-primary-soft text-primary-hover" },
  awaiting: { label: "Awaiting confirmation", tone: "bg-info-soft text-info" },
  paid: { label: "Paid", tone: "bg-success-soft text-success" },
};

// The plan of instalments for a project. The owner manages it; the homeowner sees the same
// list. It is only a plan: recording a payment is still done on this page, as before.
export function PaymentSchedule({
  items,
  projectId,
  side,
  manualHref,
  initialHidden = false,
}: {
  items: ScheduleItem[];
  projectId: string;
  // Who is looking; null for site staff, who can only look.
  side: PaymentSide | null;
  // Builds the "send it from my own WhatsApp" link for an instalment.
  manualHref: (item: ScheduleItem) => string;
  // The person folded the card away last time.
  initialHidden?: boolean;
}) {
  const isOwner = side === "contractor";
  const base = `/dashboard/projects/${projectId}/payments`;

  if (items.length === 0) {
    // Nothing planned: only the owner has anything to do here.
    if (!isOwner) return null;
    return (
      <section className="mb-6 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <CalendarClock className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold">Plan your payments</h2>
            <p className="mt-1 max-w-lg text-sm text-muted">
              List the instalments you expect, like &ldquo;PKR 500,000 when the foundation is complete&rdquo;. Your client sees
              the plan, and you can ask for each payment the moment its stage is done. It&apos;s only a plan: no payment is
              created until one is recorded and confirmed.
            </p>
          </div>
        </div>
        <Link href={`${base}/schedule/new`} className={`${button("primary", "sm")} shrink-0`}>
          <Plus className="size-4" aria-hidden /> Add an instalment
        </Link>
      </section>
    );
  }

  const totals = scheduleTotals(items);

  return (
    <ScheduleCollapse
      initialHidden={initialHidden}
      paidCount={items.filter((i) => i.status === "paid").length}
      openCount={items.filter((i) => i.status !== "paid").length}
      summary={
        <>
          {formatPKR(totals.scheduled)} planned · {formatPKR(totals.paid)} paid
          {totals.due > 0 && <span className="font-medium text-primary-hover"> · {formatPKR(totals.due)} due now</span>}
        </>
      }
      actions={
        isOwner ? (
          <Link href={`${base}/schedule/new`} className={button("secondary", "sm")}>
            <Plus className="size-4" aria-hidden /> Add
          </Link>
        ) : null
      }
    >
      <ul className="divide-y divide-line border-t border-line">
        {items.map((item) => {
          const { label, tone } = badge[item.status];
          const canPay = !!side && item.status === "due";
          return (
            <li key={item.id} data-paid={item.status === "paid" ? "" : undefined} className="px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {item.stageId === null
                      ? "Due from the start"
                      : item.stageDone
                        ? `${item.stageName} is complete`
                        : `Due when ${item.stageName} is complete`}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-bold tabular-nums">{formatPKR(item.amount)}</p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
                  {item.status === "paid" ? (
                    <CheckCircle2 className="size-3.5" aria-hidden />
                  ) : item.status === "awaiting" ? (
                    <Clock className="size-3.5" aria-hidden />
                  ) : null}
                  {label}
                </span>
                {item.status !== "paid" && item.confirmed > 0 && (
                  <span className="text-sm text-muted">{formatPKR(item.confirmed)} paid so far</span>
                )}
                {item.status === "due" && item.pending > 0 && (
                  <span className="text-sm text-muted">{formatPKR(item.pending)} waiting for confirmation</span>
                )}
                {isOwner && item.status !== "paid" && (
                  <span className="ml-auto flex items-center">
                    <Link
                      href={`${base}/schedule/${item.id}/edit`}
                      aria-label={`Edit ${item.title}`}
                      title="Edit"
                      className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Link>
                    <DeleteScheduleButton projectId={projectId} itemId={item.id} title={item.title} />
                  </span>
                )}
              </div>

              {(canPay || (isOwner && item.status === "due")) && (
                <div className="mt-3 flex flex-wrap items-start gap-2">
                  {isOwner && item.status === "due" && (
                    <ScheduleReminderButton projectId={projectId} itemId={item.id} manualHref={manualHref(item)} />
                  )}
                  {canPay && (
                    <Link href={`${base}/new?for=${item.id}`} className={button(isOwner ? "secondary" : "primary", "sm")}>
                      {isOwner ? "Record payment" : "I made this payment"}
                    </Link>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </ScheduleCollapse>
  );
}
