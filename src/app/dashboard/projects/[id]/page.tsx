import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Hammer,
  Pencil,
  Phone,
  SlidersHorizontal,
} from "lucide-react";
import { ClientVisibilityCard } from "@/components/client-visibility-card";
import { CompleteProjectButton } from "@/components/complete-project-button";
import { InvitePanel } from "@/components/invite-panel";
import { PhotoStrip } from "@/components/photo-strip";
import { StatementButtons } from "@/components/statement-buttons";
import { WeeklySummaryCard } from "@/components/weekly-summary-card";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { SiteIllustration } from "@/components/site-illustration";
import { StageStrip } from "@/components/stage-strip";
import { TimelineFeed } from "@/components/timeline-feed";
import { MoneyBars, ProgressRing } from "@/components/viz";
import { fetchExpenseTotals } from "@/lib/expenses";
import { daysFromToday, formatDate, formatPKR, formatRelativeDate, karachiDay } from "@/lib/format";
import { awaitingMyResponse, fetchPaymentTotals, viewerSide } from "@/lib/payments";
import { getOrigin } from "@/lib/origin";
import { overallProgress } from "@/lib/project";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { fetchTimeline } from "@/lib/timeline";
import { one, type ClientInfo, type Milestone } from "@/lib/types";
import { button } from "@/lib/ui";
import { fetchProjectPhotos } from "@/lib/updates";
import { getViewer } from "@/lib/viewer";
import { progressMessage, whatsappHref } from "@/lib/whatsapp";

type Budget = { amount: number; visible_to_client: boolean };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  return { title: project?.name ?? "Project" };
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-rise rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const linkClass = "inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-foreground";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const supabase = await createClient();

  const { data: details } = await supabase
    .from("projects")
    .select(
      "weekly_summary, last_summary_at, company:companies(weekly_summary), client:clients(id, name, email, phone, user_id), budget:project_budgets(amount, visible_to_client), milestones(id, name, position, status, progress_percent)",
    )
    .eq("id", id)
    .order("position", { referencedTable: "milestones" })
    .maybeSingle();

  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";
  const side = viewerSide(isTeam, isOwner);
  const client = one(details?.client as ClientInfo | ClientInfo[] | null);
  const budget = one(details?.budget as Budget | Budget[] | null);
  const milestones = (details?.milestones ?? []) as Milestone[];
  const percent = overallProgress(milestones);

  const [photos, timeline, expenseTotals, paymentTotals, lastUpdateRow, updateCount, sharedExpenseCount] = await Promise.all([
    fetchProjectPhotos(supabase, id, 10),
    fetchTimeline(supabase, id, 5),
    fetchExpenseTotals(supabase, id),
    fetchPaymentTotals(supabase, id),
    supabase
      .from("project_updates")
      .select("update_date")
      .eq("project_id", id)
      .order("update_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Counts for the owner's "what your client sees" summary.
    supabase.from("project_updates").select("id", { count: "exact", head: true }).eq("project_id", id),
    supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .eq("client_visible", true),
  ]);
  const waitingOnMe = awaitingMyResponse(paymentTotals, side);
  const cover = photos[0]?.full ?? null;
  const lastUpdateDate = (lastUpdateRow.data?.update_date as string | undefined) ?? null;

  // Where the build is right now: the first stage that has started but isn't finished.
  const current =
    milestones.find((m) => m.progress_percent > 0 && m.progress_percent < 100) ??
    milestones.find((m) => m.progress_percent < 100);

  // Timing facts for the hero.
  const startedDays = project.start_date ? -daysFromToday(project.start_date) : null;
  const daysToGo = project.expected_completion_date ? daysFromToday(project.expected_completion_date) : null;
  const dueText =
    project.status === "completed"
      ? project.completed_at
        ? `Completed on ${formatDate(karachiDay(project.completed_at))}`
        : "Completed"
      : daysToGo === null
        ? null
        : daysToGo > 0
          ? `${daysToGo} ${daysToGo === 1 ? "day" : "days"} to go`
          : daysToGo === 0
            ? "Due today"
            : `${Math.abs(daysToGo)} ${Math.abs(daysToGo) === 1 ? "day" : "days"} past the target date`;

  // Only the owner can fetch the invite token; build the shareable link on the server.
  let inviteLink: string | null = null;
  if (isOwner && client && !client.user_id) {
    const { data: token } = await supabase.rpc("get_client_invite_token", { p_client_id: client.id });
    if (token) {
      inviteLink = `${await getOrigin()}/invite/${token}`;
    }
  }

  const base = `/dashboard/projects/${id}`;

  // A ready-to-send WhatsApp message to the client, built from progress only.
  const progressShare =
    isTeam && client
      ? whatsappHref(
          client.phone,
          progressMessage({
            clientName: client.name,
            companyName: viewer?.company?.name ?? "",
            projectName: project.name,
            progress: percent,
            currentStage: current?.name ?? null,
            currentPercent: current?.progress_percent ?? null,
            dueText,
            link: `${await getOrigin()}${base}`,
          }),
        )
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {isOwner && (
          <Link href={`${base}/edit`} className={button("secondary", "sm")}>
            <Pencil className="size-4" aria-hidden /> Edit project
          </Link>
        )}
        {isOwner && (
          <CompleteProjectButton
            projectId={id}
            projectName={project.name}
            completed={project.status === "completed"}
            openStages={milestones.filter((m) => m.progress_percent < 100).length}
            totalStages={milestones.length}
            pendingPayments={paymentTotals.pendingCount}
            disputedPayments={paymentTotals.disputedCount}
          />
        )}
        {progressShare && <WhatsAppButton href={progressShare}>Share progress</WhatsAppButton>}
        {(isOwner || !isTeam) && <StatementButtons projectId={id} projectName={project.name} />}
      </div>

      {/* Hero: the latest site photo, with one number that matters most. */}
      <section className="animate-rise relative isolate overflow-hidden rounded-3xl bg-stone-900 text-white">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, expiring URL
          <img src={cover} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 -z-20 bg-linear-to-br from-stone-700 to-stone-950">
            <SiteIllustration className="absolute -bottom-4 right-0 w-96 max-w-full opacity-30" />
          </div>
        )}
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/90 via-black/60 to-black/30" />

        <div className="flex min-h-72 flex-col justify-end gap-6 p-6 sm:min-h-80 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="self-start rounded-full bg-black/40 p-2.5 backdrop-blur sm:order-2 sm:self-auto">
            <ProgressRing percent={percent} size={156} stroke={11} label="complete">
              <span className="flex flex-col items-center leading-none">
                <span className="text-5xl font-bold">
                  {percent}
                  <span className="text-2xl font-semibold">%</span>
                </span>
                <span className="mt-1.5 text-xs font-medium text-white/75">complete</span>
              </span>
            </ProgressRing>
          </div>

          <ul className="space-y-2 text-sm text-white/85 sm:order-1">
            {current && (
              <li className="flex items-center gap-2">
                <Hammer className="size-4 shrink-0 text-amber-300" aria-hidden />
                <span>
                  Now: <span className="font-semibold text-white">{current.name}</span> ({current.progress_percent}%)
                </span>
              </li>
            )}
            {project.start_date && (
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0 text-amber-300" aria-hidden />
                <span>
                  Started {formatDate(project.start_date)}
                  {startedDays !== null && startedDays > 0 && ` · day ${startedDays}`}
                </span>
              </li>
            )}
            {dueText && (
              <li className="flex items-center gap-2">
                <CalendarClock className="size-4 shrink-0 text-amber-300" aria-hidden />
                <span>
                  {project.expected_completion_date && project.status !== "completed"
                    ? `Due ${formatDate(project.expected_completion_date)} · `
                    : ""}
                  <span className="font-semibold text-white">{dueText}</span>
                </span>
              </li>
            )}
            <li className="flex items-center gap-2">
              <Clock className="size-4 shrink-0 text-amber-300" aria-hidden />
              <span>
                {lastUpdateDate ? `Last site update ${formatRelativeDate(lastUpdateDate).toLowerCase()}` : "No site updates yet"}
              </span>
            </li>
          </ul>

        </div>
      </section>

      {waitingOnMe > 0 && (
        <Link
          href={`${base}/payments`}
          className="animate-rise flex items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-4 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <span className="flex items-center gap-2.5">
            <Clock className="size-5" aria-hidden />
            {waitingOnMe === 1
              ? "1 payment is waiting for your confirmation"
              : `${waitingOnMe} payments are waiting for your confirmation`}
          </span>
          <ArrowRight className="size-5 shrink-0" aria-hidden />
        </Link>
      )}

      <Card
        title="Progress by stage"
        action={
          isTeam ? (
            <Link href={`${base}/progress`} className={linkClass}>
              <SlidersHorizontal className="size-4" aria-hidden /> Update
            </Link>
          ) : (
            <Link href={`${base}/progress`} className={linkClass}>
              Details <ArrowRight className="size-4" aria-hidden />
            </Link>
          )
        }
      >
        <StageStrip milestones={milestones} href={`${base}/progress`} />
      </Card>

      <div className={`grid items-start gap-5 ${isOwner ? "lg:grid-cols-2" : ""}`}>
      <Card
        title="Money"
        action={
          <span className="flex items-center gap-4">
            {side !== null || !isTeam ? (
              <Link href={`${base}/payments`} className={linkClass}>
                Payments{waitingOnMe > 0 ? ` (${waitingOnMe})` : ""} <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
            <Link href={`${base}/expenses`} className={linkClass}>
              Expenses <ArrowRight className="size-4" aria-hidden />
            </Link>
          </span>
        }
      >
        <MoneyBars
          budget={budget?.amount ?? null}
          received={isTeam && !isOwner ? null : paymentTotals.confirmedTotal}
          spent={expenseTotals.total}
          receivedLabel={isTeam ? "Received from client" : "Paid so far"}
          spentLabel={isTeam ? "Spent" : "Expenses shared with you"}
        />
        {(paymentTotals.pendingCount > 0 || paymentTotals.disputedCount > 0 || (isTeam && budget && !budget.visible_to_client)) && (
          <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
            {paymentTotals.pendingCount > 0 && (
              <li className="text-primary-hover">
                {formatPKR(paymentTotals.pendingTotal)} in payments awaiting confirmation
              </li>
            )}
            {paymentTotals.disputedCount > 0 && (
              <li className="text-danger">{paymentTotals.disputedCount} disputed, not counted</li>
            )}
            {isTeam && budget && !budget.visible_to_client && (
              <li className="text-muted">The budget is hidden from your client.</li>
            )}
          </ul>
        )}
      </Card>

      {isOwner && client && (
        <WeeklySummaryCard
          projectId={id}
          clientName={client.name}
          clientJoined={!!client.user_id}
          enabled={details?.weekly_summary ?? true}
          companyEnabled={one(details?.company as { weekly_summary: boolean } | { weekly_summary: boolean }[] | null)?.weekly_summary ?? false}
          active={project.status === "active" && !project.archived_at}
          lastSentAt={details?.last_summary_at ?? null}
        />
      )}

      {isOwner && (
        <ClientVisibilityCard
          projectId={id}
          updates={updateCount.count ?? 0}
          payments={paymentTotals.confirmedCount + paymentTotals.pendingCount + paymentTotals.disputedCount}
          expensesShared={sharedExpenseCount.count ?? 0}
          expensesTotal={expenseTotals.count}
          sharedAmount={expenseTotals.sharedTotal}
          hiddenAmount={expenseTotals.total - expenseTotals.sharedTotal}
          budgetShown={budget ? budget.visible_to_client : null}
        />
      )}
      </div>

      {photos.length > 0 && (
        <Card
          title="Latest photos"
          action={
            <Link href={`${base}/updates`} className={linkClass}>
              All updates <ArrowRight className="size-4" aria-hidden />
            </Link>
          }
        >
          <PhotoStrip photos={photos} />
        </Card>
      )}

      <div className={`grid items-start gap-5 ${isTeam && client ? "lg:grid-cols-5" : ""}`}>
        <div className="lg:col-span-3">
      <Card
        title="Recent activity"
        action={
          <Link href={`${base}/timeline`} className={linkClass}>
            Full timeline <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      >
        {timeline.events.length > 0 ? (
          <TimelineFeed events={timeline.events} />
        ) : (
          <p className="text-sm text-muted">Nothing here yet. Updates, shared expenses and payments will appear as they happen.</p>
        )}
      </Card>
        </div>
        <div className="lg:col-span-2">
      {isTeam && client && (
        <Card title="Client">
          <p className="font-medium">{client.name}</p>
          <p className="text-sm text-muted">{client.email}</p>
          {client.phone && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Phone className="size-3.5" aria-hidden /> {client.phone}
            </p>
          )}

          {client.user_id ? (
            <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden /> {client.name} has joined and can see this project.
            </p>
          ) : inviteLink ? (
            <div className="mt-5 border-t border-line pt-5">
              <h3 className="text-sm font-semibold">Invite {client.name}</h3>
              <p className="mt-1 mb-3 text-sm text-muted">
                Share this private link. They set a password and see only this project.
              </p>
              <InvitePanel
                link={inviteLink}
                clientName={client.name}
                clientPhone={client.phone}
                companyName={viewer?.company?.name ?? ""}
                projectName={project.name}
              />
            </div>
          ) : null}
        </Card>
      )}
        </div>
      </div>

    </div>
  );
}
