import { redirect } from "next/navigation";
import { LeadsBoard } from "@/components/leads-board";
import { LeadsHero, LeadsStats } from "@/components/leads-overview";
import { todayIn } from "@/lib/format";
import { fetchLeads, fetchLeadStages, leadAccess, leadStats } from "@/lib/leads";
import { PLANS } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ due?: string }> }) {
  const viewer = await getViewer();
  const access = leadAccess(viewer);
  if (!viewer?.company || !access.see) redirect("/dashboard");
  const company = viewer.company;

  const supabase = await createClient();
  const [stages, leads] = await Promise.all([fetchLeadStages(supabase), fetchLeads(supabase)]);
  const today = todayIn(company.timeZone);
  const stats = leadStats(leads, today);
  const open = leads.filter((l) => l.status === "open");
  const byStage = stages.map((s) => {
    const inStage = open.filter((l) => l.stageId === s.id);
    return { ...s, count: inStage.length, value: inStage.reduce((sum, l) => sum + (l.budget ?? 0), 0) };
  });
  const limit = PLANS[company.plan].openLeads;
  const { due: showDue } = await searchParams;

  return (
    <main className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <LeadsHero
        stats={stats}
        stages={byStage}
        currency={company.currency}
        canAdd={access.change}
        plan={limit !== null ? { used: open.length, limit, name: PLANS[company.plan].name, upgrade: access.owner } : null}
      />

      {leads.length > 0 && <LeadsStats stats={stats} currency={company.currency} />}

      {stages.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-muted">
          There are no lead stages yet. {access.owner ? "Add one in Settings, under Leads." : "Ask the company owner to add one."}
        </p>
      ) : (
        <LeadsBoard
          // A new key when "Follow-ups due" is opened from a link, so the board starts on that view.
          key={showDue ? "due" : "open"}
          leads={leads}
          stages={stages}
          today={today}
          currency={company.currency}
          canChange={access.change}
          initialView={showDue ? "follow-ups" : "open"}
        />
      )}
    </main>
  );
}
