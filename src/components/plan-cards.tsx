"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { RequestUpgradeButton } from "@/components/request-upgrade-button";
import { PLAN_IDS, PLANS, type PlanId } from "@/lib/plans";
import { button } from "@/lib/ui";

type Row = { label: string; free: string | boolean; pro: string | boolean; business: string | boolean };

// What each plan includes, row by row. The project limit, WhatsApp and statements come from PLANS
// (so they can't disagree with the checks); the rest is the same on every plan.
const rows: Row[] = [
  {
    label: "Active projects at once",
    free: String(PLANS.free.activeProjects),
    pro: `Up to ${PLANS.pro.activeProjects}`,
    business: "Unlimited",
  },
  { label: "Your client's own project page", free: true, pro: true, business: true },
  { label: "Progress, site updates and photos", free: true, pro: true, business: true },
  { label: "Expenses and receipts, shared as you choose", free: true, pro: true, business: true },
  { label: "Payments both sides confirm, and a payment schedule", free: true, pro: true, business: true },
  { label: "Documents: contracts, drawings, permits", free: true, pro: true, business: true },
  { label: "Email and in-app notifications, weekly summary", free: true, pro: true, business: true },
  { label: "Automatic WhatsApp updates to your client", free: PLANS.free.whatsapp, pro: PLANS.pro.whatsapp, business: PLANS.business.whatsapp },
  { label: "PDF project statements", free: PLANS.free.statements, pro: PLANS.pro.statements, business: PLANS.business.statements },
  { label: "Team accounts for your staff", free: false, pro: "Coming soon", business: "Coming soon" },
  { label: "Support", free: "Email", pro: "Email", business: "Priority" },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="size-4 shrink-0 text-success" aria-label="Included" />;
  if (value === false) return <X className="size-4 shrink-0 text-muted/60" aria-label="Not included" />;
  return <span className="text-sm font-medium">{value}</span>;
}

export type PlanCta = { kind: "link"; href: string; label: string } | { kind: "request"; label: string } | null;
// Where each plan's button goes, for monthly and for yearly billing. Plain data, not a function: it is
// handed from a server page to this client component.
export type PlanCtas = { monthly: Record<PlanId, PlanCta>; yearly: Record<PlanId, PlanCta> };

// The three plans as cards, with a monthly / yearly switch. `ctas` decides where each button goes,
// so the public pricing page and the settings page can share the cards.
export function PlanCards({
  current,
  ctas,
}: {
  // The plan the viewer is on, when there is one.
  current?: PlanId;
  ctas: PlanCtas;
}) {
  const [yearly, setYearly] = useState(false);

  return (
    <div>
      <div className="flex justify-center">
        <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-line bg-surface p-1 text-sm font-medium">
          {[
            { id: false, label: "Monthly" },
            { id: true, label: "Yearly · 2 months free" },
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

      <ul className="mt-8 grid gap-5 lg:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          const cta = (yearly ? ctas.yearly : ctas.monthly)[id];
          const isCurrent = current === id;
          const featured = id === "pro";
          const perMonth = plan.monthlyUsd === null ? null : yearly && plan.yearlyUsd ? Math.round((plan.yearlyUsd / 12) * 100) / 100 : plan.monthlyUsd;
          return (
            <li
              key={id}
              className={`flex flex-col rounded-3xl border bg-surface p-6 ${featured ? "border-primary shadow-lg shadow-primary/10" : "border-line"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {isCurrent ? (
                  <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">Your plan</span>
                ) : featured ? (
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-hover">Most popular</span>
                ) : null}
              </div>
              <p className="mt-1 min-h-10 text-sm text-muted">{plan.blurb}</p>

              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{perMonth === null ? "$0" : `$${perMonth}`}</span>
                <span className="text-sm text-muted">{perMonth === null ? "forever" : "a month"}</span>
              </p>
              <p className="mt-1 min-h-5 text-xs text-muted">
                {plan.monthlyUsd === null
                  ? "No card needed."
                  : yearly
                    ? `Billed $${plan.yearlyUsd} once a year.`
                    : plan.approxMonthlyPkr
                      ? `About PKR ${plan.approxMonthlyPkr.toLocaleString("en-US")} a month.`
                      : ""}
              </p>

              {cta && !isCurrent && cta.kind === "link" && (
                <Link href={cta.href} className={`${button(featured ? "primary" : "secondary")} mt-5 w-full`}>
                  {cta.label}
                </Link>
              )}
              {cta && !isCurrent && cta.kind === "request" && id !== "free" && (
                <RequestUpgradeButton plan={id} yearly={yearly} label={cta.label} featured={featured} />
              )}
              {isCurrent && <p className="mt-5 rounded-lg bg-surface-2 py-2.5 text-center text-sm font-semibold">You are on this plan</p>}

              <ul className="mt-6 space-y-3 border-t border-line pt-5">
                {rows.map((row) => {
                  const value = row[id];
                  return (
                    <li key={row.label} className={`flex items-start justify-between gap-3 text-sm ${value === false ? "text-muted" : ""}`}>
                      <span>{row.label}</span>
                      <Cell value={value} />
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
