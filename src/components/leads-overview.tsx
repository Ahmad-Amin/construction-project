import Link from "next/link";
import { CalendarClock, Contact, Plus, TrendingUp, Trophy } from "lucide-react";
import { StatTile } from "@/components/viz";
import { formatMoneyCompact } from "@/lib/format";
import { stageHex, type LeadStage, type LeadStats } from "@/lib/leads";
import { button } from "@/lib/ui";

// The top of the leads page: a warm opening like the dashboard's, with the pipeline at a glance beside it, then the
// four numbers that matter.

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function LeadsHero({
  stats,
  stages,
  currency,
  canAdd,
  plan,
}: {
  stats: LeadStats;
  // Each stage with its open leads (count and rough budgets).
  stages: (LeadStage & { count: number; value: number })[];
  currency: string;
  canAdd: boolean;
  // On a plan with a limit: how many of the open leads are used, and whether to offer the upgrade.
  plan: { used: number; limit: number; name: string; upgrade: boolean } | null;
}) {
  const due = stats.dueToday + stats.overdue;
  const summary =
    stats.open === 0
      ? "No open leads right now. Add the next enquiry the moment it comes in, and BuildPeek reminds you when to follow up."
      : `${plural(stats.open, "open lead", "open leads")}${stats.pipeline > 0 ? `, worth about ${formatMoneyCompact(stats.pipeline, currency)}` : ""}. ${
          due > 0 ? `${plural(due, "follow-up needs", "follow-ups need")} you today.` : "No follow-ups due today."
        }`;
  const most = Math.max(1, ...stages.map((s) => s.count));

  return (
    <section className="bg-hero animate-rise relative overflow-hidden rounded-3xl border border-line px-6 py-7 sm:px-8 sm:py-8">
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center">
        <div>
          <p className="text-sm font-medium text-muted">Your pipeline</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Leads</h1>
          <p className="mt-2 max-w-xl text-muted">{summary}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {canAdd && (
              <Link href="/dashboard/leads/new" className={button("primary")}>
                <Plus className="size-4" aria-hidden /> Add lead
              </Link>
            )}
            {due > 0 && (
              <Link href="/dashboard/leads?due=1" className={button("secondary")}>
                <CalendarClock className="size-4 text-data-accent" aria-hidden /> {plural(due, "follow-up", "follow-ups")} due
              </Link>
            )}
            {plan && (
              <span className="inline-flex items-center gap-2 rounded-full bg-surface/70 px-3 py-1.5 text-xs font-medium text-muted ring-1 ring-line backdrop-blur">
                {plan.used} of {plan.limit} open leads on {plan.name}
                {plan.upgrade && plan.used >= plan.limit && (
                  <Link href="/dashboard/settings#plan" className="font-semibold text-data-accent hover:underline">
                    Upgrade
                  </Link>
                )}
              </span>
            )}
          </div>
        </div>

        {stats.open > 0 && (
          <div className="rounded-2xl bg-surface/75 p-4 ring-1 ring-line backdrop-blur sm:p-5" aria-label="Open leads by stage">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">By stage</p>
            <ul className="mt-3 space-y-2.5">
              {stages.map((s, i) => (
                <li key={s.id} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                  <span className="truncate text-muted">{s.name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-line/60" aria-hidden>
                    {s.count > 0 && (
                      <span
                        className="animate-grow block h-full rounded-full"
                        style={{ width: `${Math.max(6, (s.count / most) * 100)}%`, background: stageHex(s.color), animationDelay: `${120 + i * 70}ms` }}
                      />
                    )}
                  </span>
                  <span className="min-w-[6.5rem] whitespace-nowrap text-right font-semibold tabular-nums">
                    {s.count}
                    {s.value > 0 && <span className="ml-1.5 text-xs font-normal text-muted">{formatMoneyCompact(s.value, currency)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function LeadsStats({ stats, currency }: { stats: LeadStats; currency: string }) {
  const due = stats.dueToday + stats.overdue;
  const closed = stats.won + stats.lost;
  return (
    <section aria-label="Overview" className="grid grid-cols-2 gap-4 lg:gap-6 xl:grid-cols-4">
      <StatTile icon={Contact} label="Open leads" value={String(stats.open)} sub={stats.addedThisWeek > 0 ? `${stats.addedThisWeek} added this week` : "None added this week"} />
      <StatTile
        icon={TrendingUp}
        label="Pipeline value"
        value={stats.pipeline > 0 ? formatMoneyCompact(stats.pipeline, currency) : "—"}
        sub={stats.withBudget > 0 ? `From ${plural(stats.withBudget, "lead", "leads")} with a budget` : "Add rough budgets to see it"}
        delay={60}
      />
      <StatTile
        icon={CalendarClock}
        label="Follow-ups due"
        value={String(due)}
        sub={stats.overdue > 0 ? `${stats.overdue} overdue` : due > 0 ? "All due today" : "All caught up"}
        delay={120}
      />
      <StatTile
        icon={Trophy}
        label="Won, last 90 days"
        value={String(stats.won)}
        sub={closed > 0 ? `${Math.round((stats.won / closed) * 100)}% win rate` : "Nothing closed yet"}
        delay={180}
      />
    </section>
  );
}
