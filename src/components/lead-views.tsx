import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createLead } from "@/app/dashboard/leads/actions";
import { FormFrame, FormHeading } from "@/components/form-frame";
import { LeadForm } from "@/components/lead-form";
import { LeadPanel } from "@/components/lead-panel";
import { todayIn } from "@/lib/format";
import { fetchLead, fetchLeadEvents, fetchLeadStages, leadAccess } from "@/lib/leads";
import { phoneCountryFor } from "@/lib/phone";
import { leadLimitMessage, PLANS } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";

// The lead screens. Each is used twice: as a full page (a direct visit, a refresh, a link from a reminder) and inside
// the slide-over panel that opens over the leads board. `sheet` only changes the wrapper.

function PageFrame({ sheet, children }: { sheet?: boolean; children: React.ReactNode }) {
  if (sheet) return <FormFrame sheet>{children}</FormFrame>;
  return (
    <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link href="/dashboard/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All leads
      </Link>
      <div className="max-w-3xl">{children}</div>
    </main>
  );
}

export async function NewLeadView({ sheet }: { sheet?: boolean }) {
  const viewer = await getViewer();
  const access = leadAccess(viewer);
  if (!viewer?.company || !access.change) redirect("/dashboard/leads");
  const company = viewer.company;

  const supabase = await createClient();
  const [stages, openRes] = await Promise.all([
    fetchLeadStages(supabase),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const limit = PLANS[company.plan].openLeads;
  // At the plan's limit there is nothing to fill in: say so, and what to do. (The database refuses the lead too; this is
  // only the friendly version of a rule that can't be got round.)
  if (limit !== null && (openRes.count ?? 0) >= limit) {
    return (
      <PageFrame sheet={sheet}>
        <FormHeading>Add a lead</FormHeading>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="flex items-start gap-2 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-data-accent" aria-hidden />
            {leadLimitMessage(company.plan)}
          </p>
          {access.owner && (
            <Link href="/dashboard/settings#plan" className={`${button("primary", "sm")} mt-4`}>
              See plans
            </Link>
          )}
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame sheet={sheet}>
      <FormHeading>Add a lead</FormHeading>
      <LeadForm
        mode="create"
        sheet={sheet}
        action={createLead}
        stages={stages}
        currency={company.currency}
        phoneCountry={phoneCountryFor((await headers()).get("x-vercel-ip-country"), company.timeZone)}
        today={todayIn(company.timeZone)}
        cancelHref="/dashboard/leads"
        initial={{ name: "", phone: "", email: "", stage_id: stages[0]?.id ?? "", work_type: "", size: "", location: "", budget: "", source: "", notes: "" }}
      />
    </PageFrame>
  );
}

export async function LeadDetailView({ leadId, sheet }: { leadId: string; sheet?: boolean }) {
  const viewer = await getViewer();
  const access = leadAccess(viewer);
  if (!viewer?.company || !access.see) redirect("/dashboard");
  const company = viewer.company;

  const supabase = await createClient();
  const lead = await fetchLead(supabase, leadId);
  if (!lead) notFound();
  const [stages, events, project] = await Promise.all([
    fetchLeadStages(supabase),
    fetchLeadEvents(supabase, lead.id),
    lead.projectId ? supabase.from("projects").select("name").eq("id", lead.projectId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <PageFrame sheet={sheet}>
      <LeadPanel
        lead={lead}
        stages={stages}
        events={events}
        today={todayIn(company.timeZone)}
        currency={company.currency}
        timeZone={company.timeZone}
        phoneCountry={phoneCountryFor((await headers()).get("x-vercel-ip-country"), company.timeZone)}
        canChange={access.change}
        isOwner={access.owner}
        projectName={(project.data as { name: string } | null)?.name ?? null}
      />
    </PageFrame>
  );
}
