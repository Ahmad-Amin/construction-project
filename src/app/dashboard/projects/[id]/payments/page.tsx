import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Banknote, Clock, Plus } from "lucide-react";
import { PaymentCard } from "@/components/payment-card";
import { formatPKR } from "@/lib/format";
import {
  awaitingMyResponse,
  fetchPayments,
  fetchPaymentTotals,
  viewerSide,
} from "@/lib/payments";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Payments" };

const PAGE_SIZE = 100;

export default async function PaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";
  const side = viewerSide(isTeam, isOwner);

  const supabase = await createClient();
  const [payments, totals] = await Promise.all([
    fetchPayments(supabase, id, PAGE_SIZE),
    fetchPaymentTotals(supabase, id),
  ]);
  const waitingOnMe = awaitingMyResponse(totals, side);
  const total = totals.confirmedCount + totals.pendingCount + totals.disputedCount;

  return (
    <div>
      {waitingOnMe > 0 && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary-hover"
        >
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {waitingOnMe === 1
            ? "1 payment is waiting for your confirmation."
            : `${waitingOnMe} payments are waiting for your confirmation.`}
        </p>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <p className="text-sm text-muted">{side === "client" ? "Total paid (confirmed)" : "Total received (confirmed)"}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-success">{formatPKR(totals.confirmedTotal)}</p>
        <p className="mt-1 text-sm text-muted">
          {totals.confirmedCount} confirmed {totals.confirmedCount === 1 ? "payment" : "payments"}
        </p>

        {(totals.pendingCount > 0 || totals.disputedCount > 0) && (
          <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            {totals.pendingCount > 0 && (
              <li className="flex items-center gap-2 text-primary-hover">
                <Clock className="size-4 shrink-0" aria-hidden />
                {formatPKR(totals.pendingTotal)} awaiting confirmation ({totals.pendingCount})
              </li>
            )}
            {totals.disputedCount > 0 && (
              <li className="flex items-center gap-2 text-danger">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                {totals.disputedCount} disputed, not counted in the total
              </li>
            )}
          </ul>
        )}
      </section>

      <div className="mt-6 mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Payments</h2>
        {side && (
          <Link href={`/dashboard/projects/${id}/payments/new`} className={button("primary", "sm")}>
            <Plus className="size-4" aria-hidden /> {side === "client" ? "I made a payment" : "Record payment"}
          </Link>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Banknote className="size-6" aria-hidden />
          </span>
          <h3 className="mt-4 font-semibold">No payments yet</h3>
          <p className="mt-1 max-w-xs text-sm text-muted">
            {side === "client"
              ? "When you pay your contractor, record it here. They'll confirm it, so you both have the same record."
              : side === "contractor"
                ? "Record each instalment you receive. Your client confirms it, so you both have the same record. This only keeps a record; no money moves through the app."
                : "Payments recorded by the owner or the client will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <PaymentCard key={p.id} payment={p} projectId={id} viewerId={viewer?.userId} side={side} />
          ))}
          {total > PAGE_SIZE && (
            <p className="text-center text-sm text-muted">Showing the latest {PAGE_SIZE} payments.</p>
          )}
        </div>
      )}
    </div>
  );
}
