import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, BellRing, Banknote, ChevronDown, Hammer, Plus, Receipt, Trash2 } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import {
  ActivityFeed,
  AttentionPanel,
  FreshPhotos,
  GreetingHero,
} from "@/components/dashboard-sections";
import { ProjectCard } from "@/components/project-card";
import { SiteIllustration } from "@/components/site-illustration";
import { StatTile } from "@/components/viz";
import { GettingStartedCard } from "@/components/getting-started-card";
import { fetchDashboard } from "@/lib/dashboard";
import { isDemoEmail } from "@/lib/demo";
import { fetchGettingStarted } from "@/lib/getting-started";
import { formatPKRCompact } from "@/lib/format";
import { viewerSide } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";
import { createCompany } from "./actions";

export const metadata = { title: "Dashboard" };

function greetingFor(hourInKarachi: number) {
  if (hourInKarachi < 12) return "Good morning";
  if (hourInKarachi < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  // Brand-new account: no company and not an invited homeowner.
  if (!viewer.company && !viewer.isClient) {
    return (
      <main className="mx-auto w-full max-w-sm px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Set up your company</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          This is the name your clients will see on their project page.
        </p>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <AuthForm
            action={createCompany}
            submitLabel="Continue"
            fields={[{ name: "name", label: "Company name", autoComplete: "organization" }]}
          />
        </div>
      </main>
    );
  }

  const isOwner = viewer.company?.role === "owner";
  const isCompany = !!viewer.company;
  const side = viewerSide(isCompany, isOwner);

  // RLS decides what comes back: a company sees its projects, a homeowner only their own.
  const supabase = await createClient();
  // The first-run checklist is for owners only, and not for the shared demo account.
  const wantsChecklist = isOwner && !isDemoEmail(viewer.email);
  const [dashboard, profile, gettingStarted] = await Promise.all([
    fetchDashboard(supabase, side),
    supabase.from("profiles").select("name").eq("id", viewer.userId).maybeSingle(),
    wantsChecklist ? fetchGettingStarted(supabase, viewer.userId, !!viewer.company?.logoUrl) : Promise.resolve(null),
  ]);
  const { kpis, attention, activity, photos } = dashboard;
  const projects = dashboard.projects.filter((p) => !p.archived);
  const archivedProjects = dashboard.projects.filter((p) => p.archived);

  // A homeowner with a single project goes straight to it.
  if (!isCompany && dashboard.projects.length === 1) {
    redirect(`/dashboard/projects/${dashboard.projects[0].id}`);
  }

  const firstName = (profile.data?.name ?? "").trim().split(/\s+/)[0];
  const hour = Number(
    new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi", hour: "numeric", hour12: false }),
  );
  const dateText = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const needing = attention.length;
  const summary = isCompany
    ? projects.length === 0
      ? "Let's set up your first project."
      : needing > 0
        ? `${kpis.active} active ${kpis.active === 1 ? "project" : "projects"}, and ${needing} ${needing === 1 ? "thing needs" : "things need"} your attention.`
        : `${kpis.active} active ${kpis.active === 1 ? "project" : "projects"}, and everything is up to date.`
    : "Here's where your projects stand.";

  const newProjectButton = isOwner ? (
    <Link href="/dashboard/projects/new" className={button("primary")}>
      <Plus className="size-4" aria-hidden /> New project
    </Link>
  ) : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <GreetingHero
        greeting={`${greetingFor(hour)}${firstName ? `, ${firstName}` : ""}`}
        dateText={dateText}
        summary={summary}
        action={projects.length > 0 ? newProjectButton : undefined}
      />

      {gettingStarted && <GettingStartedCard data={gettingStarted} />}

      {deleted && (
        <p role="status" className="animate-rise flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm font-medium">
          <Trash2 className="size-4 shrink-0 text-muted" aria-hidden />
          Deleted &ldquo;{deleted}&rdquo; and everything in it.
        </p>
      )}

      {isOwner && projects.length > 0 && (
        <section aria-label="Overview" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            icon={Hammer}
            label="Active projects"
            value={String(kpis.active)}
            sub={
              kpis.onHold + kpis.completed > 0
                ? `${kpis.onHold} on hold · ${kpis.completed} completed`
                : "All on track"
            }
          />
          <StatTile
            icon={Banknote}
            label="Received from clients"
            value={formatPKRCompact(kpis.received)}
            sub={
              kpis.pendingReceived > 0
                ? `${formatPKRCompact(kpis.pendingReceived)} awaiting confirmation`
                : kpis.budget > 0
                  ? `${Math.round((kpis.received / kpis.budget) * 100)}% of budgets`
                  : undefined
            }
            spark={{ values: kpis.receivedSeries, label: "Confirmed payments received per month, last 8 months" }}
            delay={60}
          />
          <StatTile
            icon={Receipt}
            label="Spent on projects"
            value={formatPKRCompact(kpis.spent)}
            sub={kpis.budget > 0 ? `${Math.round((kpis.spent / kpis.budget) * 100)}% of budgets` : undefined}
            spark={{ values: kpis.spentSeries, label: "Expenses recorded per month, last 8 months" }}
            delay={120}
          />
          <StatTile
            icon={BellRing}
            label="Needs attention"
            value={String(attention.length)}
            sub={attention.length === 0 ? "All caught up" : "See the list below"}
            delay={180}
          />
        </section>
      )}

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-8">
          {projects.length > 0 && attention.length > 0 && <AttentionPanel items={attention} />}

          <section aria-label="Projects">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {isCompany ? "Projects" : "Your projects"}
                <span className="ml-2 text-sm font-normal text-muted">{projects.length}</span>
              </h2>
            </div>

            {projects.length === 0 ? (
              <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center">
                <SiteIllustration className="w-64 max-w-full" />
                <h3 className="mt-4 text-lg font-semibold">
                  {archivedProjects.length > 0
                    ? "All your projects are archived"
                    : isOwner
                      ? "Your first project starts here"
                      : "No projects yet"}
                </h3>
                <p className="mt-1 max-w-sm text-sm text-muted">
                  {archivedProjects.length > 0
                    ? "Start a new one, or open an archived project below to restore it."
                    : isOwner
                      ? "Add a project and your client, share one link, and they can follow progress, payments and site photos on their phone."
                      : "Projects shared with you will appear here."}
                </p>
                {newProjectButton && <div className="mt-6">{newProjectButton}</div>}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {projects.map((p, i) => (
                  <ProjectCard key={p.id} project={p} perspective={isCompany ? "company" : "client"} index={i} />
                ))}
              </div>
            )}
          </section>

          {projects.length > 0 && <FreshPhotos photos={photos} />}

          {archivedProjects.length > 0 && (
            <details className="group rounded-2xl border border-line bg-surface">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                <Archive className="size-4 text-muted" aria-hidden />
                Archived
                <span className="text-sm font-normal text-muted">{archivedProjects.length}</span>
                <ChevronDown className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="border-t border-line p-5">
                <p className="mb-4 text-sm text-muted">
                  Kept for your records and left out of the totals above.
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  {archivedProjects.map((p, i) => (
                    <ProjectCard key={p.id} project={p} perspective={isCompany ? "company" : "client"} index={i} />
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>

        {projects.length > 0 && activity.length > 0 && (
          <aside className="xl:sticky xl:top-20">
            <ActivityFeed items={activity} />
          </aside>
        )}
      </div>
    </main>
  );
}
