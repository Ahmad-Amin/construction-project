import { PlanCards } from "@/components/plan-cards";
import { ProgressBar } from "@/components/project-bits";
import { planCtas } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { PLANS, usage, usageText, type PlanId } from "@/lib/plans";
import { CONTACT_EMAIL } from "@/lib/site";

// The owner's view of the plan: what they are on, how much of it is used, and the plans to move to.
// A client component (the cards) sits inside a server one (the facts), so the dates are worked out here.
export function PlanSection({
  plan,
  until,
  lapsed,
  activeProjects,
  timeZone,
}: {
  plan: PlanId;
  until: string | null;
  lapsed: boolean;
  activeProjects: number;
  timeZone: string;
}) {
  const info = PLANS[plan];
  const u = usage(plan, activeProjects);
  const endDay = until ? new Date(until).toLocaleDateString("en-CA", { timeZone }) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-surface-2/50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-bold">{info.name} plan</p>
          <p className="text-sm text-muted">{usageText(plan, activeProjects)}</p>
        </div>
        {u.limit !== null && (
          <div className="mt-3">
            <ProgressBar percent={Math.min(100, Math.round((activeProjects / u.limit) * 100))} />
          </div>
        )}
        {plan !== "free" && (
          <p className="mt-3 text-sm text-muted">
            {endDay ? `Paid until ${formatDate(endDay)}.` : "No end date."} To change or cancel, write to{" "}
            {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-4">{CONTACT_EMAIL}</a> : "us"}.
          </p>
        )}
        {lapsed && endDay && (
          <p role="status" className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-sm font-medium text-primary-hover">
            Your paid plan ended on {formatDate(endDay)}, so the account is on Free. Your projects and records are all still here.
            Renew to start new projects again and bring back WhatsApp updates and PDF statements.
          </p>
        )}
        {u.atLimit && (
          <p className="mt-3 text-sm text-muted">
            You are using all of your active projects. Finish or archive one to start another, or move to a bigger plan.
          </p>
        )}
      </div>

      <PlanCards current={plan} ctas={planCtas()} />
    </div>
  );
}
