import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ProgressBar } from "@/components/project-bits";
import { PLANS, usage, usageText, type PlanId } from "@/lib/plans";

// The plan, shown in the sidebar: which plan the company is on and how much of it is used, with a way
// to upgrade for the owner. Folded away, it is just a small icon with the same information on hover.
export function PlanBadge({
  plan,
  activeProjects,
  isOwner,
  lapsed = false,
  collapsed = false,
  onNavigate,
}: {
  plan: PlanId;
  activeProjects: number;
  isOwner: boolean;
  // A paid plan that has ended: the company is on Free now, and the owner should know why.
  lapsed?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { limit, atLimit } = usage(plan, activeProjects);
  const name = PLANS[plan].name;
  const summary = `${name} plan · ${usageText(plan, activeProjects)}`;
  const href = "/dashboard/settings#plan";

  if (collapsed) {
    const icon = (
      <span
        title={summary}
        className={`flex size-9 items-center justify-center rounded-lg border ${
          atLimit ? "border-primary bg-primary-soft text-primary-hover" : "border-line bg-surface-2/60 text-muted"
        }`}
      >
        <Sparkles className="size-4" aria-hidden />
        <span className="sr-only">{summary}</span>
      </span>
    );
    return (
      <div className="mb-3 flex justify-center">
        {isOwner ? (
          <Link href={href} onClick={onNavigate} aria-label={summary}>
            {icon}
          </Link>
        ) : (
          icon
        )}
      </div>
    );
  }

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide">{name} plan</span>
        {isOwner && plan === "free" && <span className="text-xs font-semibold text-primary-hover">Upgrade</span>}
        {isOwner && plan === "pro" && atLimit && <span className="text-xs font-semibold text-primary-hover">Upgrade</span>}
      </div>
      <p className="mt-1 text-xs text-muted">{usageText(plan, activeProjects)}</p>
      {limit !== null && (
        <div className="mt-2">
          <ProgressBar percent={Math.min(100, Math.round((activeProjects / limit) * 100))} thin />
        </div>
      )}
      {lapsed && <p className="mt-2 text-xs text-muted">Your paid plan has ended.</p>}
    </>
  );
  const box = `mx-3 mb-3 block rounded-xl border px-3 py-2.5 ${
    atLimit ? "border-primary/50 bg-primary-soft/50" : "border-line bg-surface-2/60"
  }`;

  return isOwner ? (
    <Link href={href} onClick={onNavigate} className={`${box} transition-colors hover:bg-surface-2`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}
