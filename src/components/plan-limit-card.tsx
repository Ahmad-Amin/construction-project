import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { PLANS, limitMessage, usageText, type PlanId } from "@/lib/plans";
import { button } from "@/lib/ui";

// Shown instead of the "New project" form when the company is at its plan's limit.
export function PlanLimitCard({ plan, activeProjects }: { plan: PlanId; activeProjects: number }) {
  const next = plan === "free" ? PLANS.pro : PLANS.business;
  return (
    <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <h2 className="mt-4 text-xl font-bold tracking-tight">You&apos;ve reached your {PLANS[plan].name} plan&apos;s limit</h2>
      <p className="mt-2 text-muted">{limitMessage(plan)}</p>
      <p className="mt-1 text-sm text-muted">Right now: {usageText(plan, activeProjects)}.</p>

      <div className="mt-6 rounded-xl border border-line bg-surface-2/50 p-4 text-sm">
        <p className="font-semibold">
          {next.name}: {next.activeProjects === null ? "unlimited active projects" : `up to ${next.activeProjects} active projects`}
        </p>
        <p className="mt-1 text-muted">
          Automatic WhatsApp updates and PDF statements are included. {next.monthlyUsd !== null && `From $${next.monthlyUsd} a month.`}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/dashboard/settings#plan" className={button("primary")}>
          See plans and upgrade <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link href="/dashboard" className={button("secondary")}>
          Finish or archive a project
        </Link>
      </div>
    </section>
  );
}
