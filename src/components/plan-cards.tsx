"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { RequestUpgradeButton } from "@/components/request-upgrade-button";
import { PLAN_IDS, PLANS, type PlanId } from "@/lib/plans";
import { button } from "@/lib/ui";

export type PlanCta = { kind: "link"; href: string; label: string } | { kind: "request"; label: string } | null;
// Where each plan's button goes, for monthly and for yearly billing. Plain data, not a function: it is
// handed from a server page to this client component.
export type PlanCtas = { monthly: Record<PlanId, PlanCta>; yearly: Record<PlanId, PlanCta> };

type Cell = string | boolean;
type Row = { label: string; free: Cell; pro: Cell; business: Cell };

// What each plan includes, row by row. The project limit, WhatsApp and statements come from PLANS
// (so they can't disagree with the checks); the rest is the same on every plan.
const rows: Row[] = [
  { label: "Active projects at once", free: String(PLANS.free.activeProjects), pro: `Up to ${PLANS.pro.activeProjects}`, business: "Unlimited" },
  { label: "Your client's own project page", free: true, pro: true, business: true },
  { label: "Progress, site updates and photos", free: true, pro: true, business: true },
  { label: "Expenses and receipts, shared as you choose", free: true, pro: true, business: true },
  { label: "Payments both sides confirm, and a payment schedule", free: true, pro: true, business: true },
  { label: "Documents: contracts, drawings, permits", free: true, pro: true, business: true },
  { label: "Email and in-app notifications, weekly summary", free: true, pro: true, business: true },
  { label: "Automatic WhatsApp updates to your client", free: PLANS.free.whatsapp, pro: PLANS.pro.whatsapp, business: PLANS.business.whatsapp },
  { label: "PDF project statements", free: PLANS.free.statements, pro: PLANS.pro.statements, business: PLANS.business.statements },
  { label: "Invoices with your logo, sent to your client", free: PLANS.free.invoices, pro: PLANS.pro.invoices, business: PLANS.business.invoices },
  { label: "Staff accounts, with access you choose per project", free: false, pro: `Up to ${PLANS.pro.staff}`, business: `Up to ${PLANS.business.staff}` },
  { label: "Support", free: "Email", pro: "Email", business: "Priority" },
];

// Site videos: shown only while they are switched on, so nobody buys a plan for something that is off.
const videoCell = (id: PlanId): Cell =>
  PLANS[id].videoMaxSeconds === 0 ? false : `${PLANS[id].videoMaxSeconds / 60} min each, ${PLANS[id].videoMonthlyMinutes} min a month`;
const videoRow: Row = { label: "Short site videos on updates", free: videoCell("free"), pro: videoCell("pro"), business: videoCell("business") };
const videoHighlight = (id: PlanId) => (PLANS[id].videoMaxSeconds ? [`Site videos, up to ${PLANS[id].videoMaxSeconds / 60} minutes`] : []);

// The three or four things worth knowing about each plan at a glance.
const highlights: Record<PlanId, string[]> = {
  free: ["1 active project", "Everything you need to run one job", "Email and in-app updates for your client"],
  pro: ["Up to 10 active projects", "Up to 3 staff accounts", "Automatic WhatsApp updates", "Invoices and PDF statements"],
  business: ["Unlimited active projects", "Up to 10 staff accounts", "Everything in Pro", "Priority support"],
};

function Mark({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto size-4 text-success" aria-label="Included" />;
  if (value === false) return <X className="mx-auto size-4 text-muted/60" aria-label="Not included" />;
  return <span className="text-sm font-medium">{value}</span>;
}

// The three plans as cards, a monthly / yearly switch, and one comparison table underneath. It adapts to
// the room it is given (not the screen), so it is as tidy in a narrow settings column as on the public
// pricing page. `ctas` decides where each button goes.
export function PlanCards({ current, ctas, videos = false }: { current?: PlanId; ctas: PlanCtas; videos?: boolean }) {
  const [yearly, setYearly] = useState(false);
  const shownRows = videos ? [...rows.slice(0, -2), videoRow, ...rows.slice(-2)] : rows;
  const shownHighlights = (id: PlanId) => (videos ? [...highlights[id], ...videoHighlight(id)] : highlights[id]);

  return (
    <div className="@container">
      <div className="flex justify-center">
        <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-line bg-surface-2/60 p-1 text-sm font-medium">
          {[
            { id: false, label: "Monthly" },
            { id: true, label: "Yearly · 1 month free" },
          ].map((o) => (
            <button
              key={String(o.id)}
              type="button"
              aria-pressed={yearly === o.id}
              onClick={() => setYearly(o.id)}
              className={`rounded-full px-4 py-1.5 transition-colors ${yearly === o.id ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-6 grid gap-4 @3xl:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const cta = (yearly ? ctas.yearly : ctas.monthly)[id];
          const isCurrent = current === id;
          const featured = id === "pro";
          const perMonth = plan.monthlyUsd === null ? null : yearly && plan.yearlyUsd ? Math.round((plan.yearlyUsd / 12) * 100) / 100 : plan.monthlyUsd;
          return (
            <li
              key={id}
              className={`flex flex-col rounded-2xl border p-5 ${
                isCurrent ? "border-success/50 bg-success-soft/20" : featured ? "border-primary bg-surface shadow-lg shadow-primary/10" : "border-line bg-surface"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {isCurrent ? (
                  <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">Your plan</span>
                ) : featured ? (
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-hover">Most popular</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted @3xl:min-h-10">{plan.blurb}</p>

              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight">{perMonth === null ? "$0" : `$${perMonth}`}</span>
                <span className="text-sm text-muted">{perMonth === null ? "forever" : "a month"}</span>
              </p>
              <p className="mt-0.5 min-h-5 text-xs text-muted">
                {plan.monthlyUsd === null
                  ? "No card needed."
                  : yearly
                    ? `Billed $${plan.yearlyUsd} once a year.`
                    : plan.approxMonthlyPkr
                      ? `About PKR ${plan.approxMonthlyPkr.toLocaleString("en-US")} a month.`
                      : ""}
              </p>

              {cta && !isCurrent && cta.kind === "link" && (
                <Link href={cta.href} className={`${button(featured ? "primary" : "secondary")} mt-4 w-full`}>
                  {cta.label}
                </Link>
              )}
              {cta && !isCurrent && cta.kind === "request" && id !== "free" && (
                <RequestUpgradeButton plan={id} yearly={yearly} label={cta.label} featured={featured} />
              )}
              {isCurrent && <p className="mt-4 rounded-lg bg-surface-2 py-2.5 text-center text-sm font-semibold">You are on this plan</p>}

              <ul className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
                {shownHighlights(id).map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Compare every feature</h3>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2/50">
                <th scope="col" className="px-4 py-3 font-medium text-muted">
                  <span className="sr-only">Feature</span>
                </th>
                {PLAN_IDS.map((id) => (
                  <th key={id} scope="col" className="w-28 px-3 py-3 text-center font-semibold @3xl:w-36">
                    {PLANS[id].name}
                    {current === id && <span className="ml-1.5 text-xs font-medium text-success">· yours</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shownRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-4 py-3 font-normal">
                    {row.label}
                  </th>
                  {PLAN_IDS.map((id) => (
                    <td key={id} className={`px-3 py-3 text-center ${row[id] === false ? "text-muted" : ""}`}>
                      <Mark value={row[id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
