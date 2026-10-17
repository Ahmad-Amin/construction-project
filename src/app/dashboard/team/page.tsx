import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Sparkles, Users } from "lucide-react";
import { ProgressBar } from "@/components/project-bits";
import { TeamManager } from "@/components/team-manager";
import { PLANS, canMakeInvoices, staffLimitText } from "@/lib/plans";
import { fetchTeam, staffPlacesUsed } from "@/lib/team";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Team" };

// The owner's staff: who is on the team, which projects each can open, what they see there (payments, budget, client
// details) and what they can do (view only, invoices, paused). Only the owner can open this page (the database refuses
// everyone else too).
export default async function TeamPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.company?.role !== "owner") redirect("/dashboard");

  const company = viewer.company;
  const team = await fetchTeam(await createClient());
  const limit = PLANS[company.plan].staff;
  const used = staffPlacesUsed(team);
  const full = used >= limit;
  const next = company.plan === "free" ? PLANS.pro : company.plan === "pro" ? PLANS.business : null;

  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-data-accent">
          <Users className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Team</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Invite your site supervisors. They post updates and photos on the projects you give them, and you decide what else
            they can see and do.
          </p>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-label="Staff accounts on your plan">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">
            Staff accounts
            <span className="ml-2 text-sm font-normal text-muted">{PLANS[company.plan].name} plan</span>
          </p>
          <p className="text-sm tabular-nums text-muted">
            {limit === 0 ? staffLimitText(company.plan) : `${used} of ${limit} used`}
          </p>
        </div>
        {limit > 0 && <div className="mt-3"><ProgressBar percent={Math.min(100, Math.round((used / limit) * 100))} /></div>}
        {limit > 0 && <p className="mt-2 text-xs text-muted">Invitations that haven&apos;t been used yet count too.</p>}

        {full && next && (
          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-line bg-surface-2/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div className="text-sm">
                <p className="font-semibold">
                  {limit === 0 ? `Your ${PLANS[company.plan].name} plan doesn't include staff accounts` : `All ${limit} staff accounts on your ${PLANS[company.plan].name} plan are in use`}
                </p>
                <p className="mt-0.5 text-muted">
                  {next.name} includes up to {next.staff}.{next.monthlyUsd !== null && ` From $${next.monthlyUsd} a month.`}
                </p>
              </div>
            </div>
            <Link href="/dashboard/settings#plan" className={button("primary", "sm")}>
              See plans <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
        {full && !next && <p className="mt-4 text-sm text-muted">Remove someone, or contact us if you need more places.</p>}
        {company.planLapsed && (
          <p className="mt-4 rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-hover">
            Your paid plan has ended. Your current staff keep working, but you can&apos;t add more until you renew.
          </p>
        )}
      </section>

      <TeamManager team={team} companyName={company.name} timeZone={company.timeZone} canInvite={!full} invoices={canMakeInvoices(company.plan)} />
    </main>
  );
}
