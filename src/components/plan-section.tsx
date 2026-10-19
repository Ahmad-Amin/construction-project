import { PlanCards } from "@/components/plan-cards";
import { ProgressBar } from "@/components/project-bits";
import { planCtas } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { PLANS, usage, type PlanId } from "@/lib/plans";
import { CONTACT_EMAIL } from "@/lib/site";
import { formatLength } from "@/lib/video-rules";

// The owner's view of the plan: what they are on, how much of it is used, and the plans to move to.
// A client component (the cards) sits inside a server one (the facts), so the dates are worked out here.
export function PlanSection({
  plan,
  until,
  lapsed,
  activeProjects,
  timeZone,
  video = null,
}: {
  plan: PlanId;
  until: string | null;
  lapsed: boolean;
  activeProjects: number;
  timeZone: string;
  // Site video minutes this month, when videos are switched on.
  video?: { usedSeconds: number; monthlySeconds: number } | null;
}) {
  const info = PLANS[plan];
  const u = usage(plan, activeProjects);
  const endDay = until ? new Date(until).toLocaleDateString("en-CA", { timeZone }) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface-2/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your plan</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight">{info.name}</p>
          </div>
          <div className="min-w-48 flex-1 sm:max-w-sm">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted">Active projects</span>
              <span className="font-medium tabular-nums">{u.limit === null ? `${activeProjects}, no limit` : `${activeProjects} of ${u.limit}`}</span>
            </div>
            {u.limit !== null ? (
              <ProgressBar percent={Math.min(100, Math.round((activeProjects / u.limit) * 100))} />
            ) : (
              <p className="text-xs text-muted">Start as many as you like.</p>
            )}
          </div>
        </div>
        {video && video.monthlySeconds > 0 && (
          <div className="mt-4 max-w-sm">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted">Video this month</span>
              <span className="font-medium tabular-nums">
                {Math.ceil(video.usedSeconds / 60)} of {video.monthlySeconds / 60} minutes
              </span>
            </div>
            <ProgressBar percent={Math.min(100, Math.round((video.usedSeconds / video.monthlySeconds) * 100))} />
            <p className="mt-1 text-xs text-muted">
              {video.usedSeconds >= video.monthlySeconds
                ? "All used. More becomes available on the 1st."
                : `${formatLength(video.monthlySeconds - video.usedSeconds)} left. Resets on the 1st; deleting a video gives its minutes back.`}
            </p>
          </div>
        )}
        {plan !== "free" && (
          <p className="mt-4 text-sm text-muted">
            {endDay ? `Paid until ${formatDate(endDay)}.` : "No end date."} To change or cancel, write to{" "}
            {CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-4">{CONTACT_EMAIL}</a> : "us"}.
          </p>
        )}
        {lapsed && endDay && (
          <p role="status" className="mt-4 rounded-lg bg-primary-soft px-3 py-2 text-sm font-medium text-primary-hover">
            Your paid plan ended on {formatDate(endDay)}, so the account is on Free. Your projects and records are all still here.
            Renew to start new projects again and bring back WhatsApp updates and PDF statements.
          </p>
        )}
        {u.atLimit && (
          <p className="mt-4 text-sm text-muted">
            You are using all of your active projects. Finish or archive one to start another, or move to a bigger plan.
          </p>
        )}
      </div>

      <PlanCards current={plan} ctas={planCtas()} videos={video !== null} />
    </div>
  );
}
