import type { SupabaseClient } from "@supabase/supabase-js";
import { todayInKarachi } from "@/lib/format";
import type { PaymentSide, PaymentStatus } from "@/lib/payments";
import { overallProgress } from "@/lib/project";
import { one, type ProjectStatus } from "@/lib/types";

export type DashboardProject = {
  id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  clientName: string | null;
  companyName: string | null;
  progress: number;
  coverUrl: string | null;
  // Budget is null when the viewer isn't allowed to see it.
  budget: number | null;
  received: number;
  spent: number;
  lastUpdate: { date: string; text: string } | null;
  daysSinceUpdate: number | null;
  // Payments this person still has to confirm.
  awaitingMe: number;
  // Archived projects are kept but left out of totals, alerts and activity.
  archived: boolean;
};

export type AttentionItem = {
  id: string;
  tone: "warn" | "info";
  projectId: string;
  projectName: string;
  text: string;
  href: string;
};

export type ActivityItem = {
  id: string;
  kind: "update" | "payment" | "expense";
  projectId: string;
  projectName: string;
  at: string;
  actor: string;
  title: string;
  amount?: number;
  status?: PaymentStatus;
  hidden?: boolean;
};

export type FreshPhoto = { id: string; url: string; projectId: string; projectName: string };

export type Dashboard = {
  projects: DashboardProject[];
  kpis: {
    active: number;
    onHold: number;
    completed: number;
    received: number;
    pendingReceived: number;
    spent: number;
    budget: number;
    receivedSeries: number[];
    spentSeries: number[];
  };
  attention: AttentionItem[];
  activity: ActivityItem[];
  photos: FreshPhoto[];
};

type ProjectRow = {
  id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  client: { name: string } | { name: string }[] | null;
  company: { name: string } | { name: string }[] | null;
  milestones: { progress_percent: number }[];
  project_updates: { update_date: string; text: string }[];
  archived_at: string | null;
  budget: { amount: number } | { amount: number }[] | null;
};
type PaymentRow = {
  id: string;
  project_id: string;
  amount: number;
  status: PaymentStatus;
  side: PaymentSide;
  payment_date: string;
  reference: string;
  created_at: string;
  created_by_name: string;
};
type ExpenseRow = {
  id: string;
  project_id: string;
  amount: number;
  expense_date: string;
  vendor_note: string;
  category: string;
  client_visible: boolean;
  created_at: string;
  created_by_name: string;
};
type UpdateRow = {
  id: string;
  project_id: string;
  text: string;
  author_name: string;
  created_at: string;
};
type PhotoRow = { id: string; project_id: string; storage_path: string; thumb_path: string | null };

const SIGNED_URL_SECONDS = 60 * 60;
const STALE_AFTER_DAYS = 7;
const MONTHS = 8;

const dayNumber = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
};

// The last `count` calendar months ending this month, oldest first, as "yyyy-mm".
function lastMonths(count: number): string[] {
  const [y, m] = todayInKarachi().split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const index = y * 12 + (m - 1) - (count - 1 - i);
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  });
}

// Everything the dashboard needs, in a few queries. Row-level security decides
// what comes back: a contractor sees their company, a homeowner only their own project.
// `side` says who is looking, so we can tell which payments are waiting on them.
export async function fetchDashboard(
  supabase: SupabaseClient,
  side: PaymentSide | null,
): Promise<Dashboard> {
  const [projectsRes, paymentsRes, expensesRes, updatesRes, photosRes] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, location, status, archived_at, client:clients(name), company:companies(name), milestones(progress_percent), project_updates(update_date, text), budget:project_budgets(amount)",
      )
      .order("created_at", { ascending: false })
      .order("update_date", { referencedTable: "project_updates", ascending: false })
      .order("created_at", { referencedTable: "project_updates", ascending: false })
      .limit(1, { referencedTable: "project_updates" }),
    supabase
      .from("payments")
      .select("id, project_id, amount, status, side, payment_date, reference, created_at, created_by_name")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("expenses")
      .select("id, project_id, amount, expense_date, vendor_note, category, client_visible, created_at, created_by_name")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("project_updates")
      .select("id, project_id, text, author_name, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("project_photos")
      .select("id, project_id, storage_path, thumb_path")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const projectRows = (projectsRes.data ?? []) as ProjectRow[];
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const expenses = (expensesRes.data ?? []) as ExpenseRow[];
  const updates = (updatesRes.data ?? []) as UpdateRow[];
  const photoRows = (photosRes.data ?? []) as PhotoRow[];

  // Photos are private; sign the small versions for covers and the "fresh" strip.
  const signed = new Map<string, string>();
  const paths = photoRows.map((p) => p.thumb_path ?? p.storage_path);
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("project-media").createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const u of data ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const photoUrl = (p: PhotoRow) => signed.get(p.thumb_path ?? p.storage_path) ?? null;
  const coverByProject = new Map<string, string>();
  for (const p of photoRows) {
    const url = photoUrl(p);
    if (url && !coverByProject.has(p.project_id)) coverByProject.set(p.project_id, url);
  }

  const today = dayNumber(todayInKarachi());
  const projects: DashboardProject[] = projectRows.map((row) => {
    const last = row.project_updates?.[0] ?? null;
    const mine = payments.filter((p) => p.project_id === row.id);
    return {
      id: row.id,
      name: row.name,
      location: row.location,
      status: row.status,
      clientName: one(row.client)?.name ?? null,
      companyName: one(row.company)?.name ?? null,
      progress: overallProgress(row.milestones),
      coverUrl: coverByProject.get(row.id) ?? null,
      budget: one(row.budget)?.amount ?? null,
      received: mine.filter((p) => p.status === "confirmed").reduce((s, p) => s + Number(p.amount), 0),
      spent: expenses.filter((e) => e.project_id === row.id).reduce((s, e) => s + Number(e.amount), 0),
      lastUpdate: last ? { date: last.update_date, text: last.text } : null,
      daysSinceUpdate: last ? today - dayNumber(last.update_date) : null,
      // Pending payments recorded by the other side are the ones waiting on this person.
      archived: !!row.archived_at,
      awaitingMe: side
        ? mine.filter((p) => p.status === "pending" && p.side !== side).length
        : 0,
    };
  });
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));

  // Everything below describes current work, so archived projects are left out.
  const live = projects.filter((p) => !p.archived);
  const liveIds = new Set(live.map((p) => p.id));
  const livePayments = payments.filter((p) => liveIds.has(p.project_id));
  const liveExpenses = expenses.filter((e) => liveIds.has(e.project_id));

  // Totals and the trend lines behind the stat tiles.
  const months = lastMonths(MONTHS);
  const receivedByMonth = new Map(months.map((m) => [m, 0]));
  const spentByMonth = new Map(months.map((m) => [m, 0]));
  for (const p of livePayments) {
    const key = p.payment_date.slice(0, 7);
    if (p.status === "confirmed" && receivedByMonth.has(key)) {
      receivedByMonth.set(key, receivedByMonth.get(key)! + Number(p.amount));
    }
  }
  for (const e of liveExpenses) {
    const key = e.expense_date.slice(0, 7);
    if (spentByMonth.has(key)) spentByMonth.set(key, spentByMonth.get(key)! + Number(e.amount));
  }

  // What needs a person's attention, most urgent first.
  const attention: AttentionItem[] = [];
  for (const p of live) {
    if (p.awaitingMe > 0) {
      attention.push({
        id: `pay-${p.id}`,
        tone: "warn",
        projectId: p.id,
        projectName: p.name,
        text:
          p.awaitingMe === 1
            ? "1 payment is waiting for your confirmation"
            : `${p.awaitingMe} payments are waiting for your confirmation`,
        href: `/dashboard/projects/${p.id}/payments`,
      });
    }
  }
  if (side === "contractor") {
    for (const p of live) {
      if (p.status !== "active") continue;
      if (p.daysSinceUpdate === null || p.daysSinceUpdate > STALE_AFTER_DAYS) {
        attention.push({
          id: `stale-${p.id}`,
          tone: "info",
          projectId: p.id,
          projectName: p.name,
          text:
            p.daysSinceUpdate === null
              ? "No site update posted yet"
              : `No site update for ${p.daysSinceUpdate} days`,
          href: `/dashboard/projects/${p.id}/updates/new`,
        });
      }
    }
  }

  // A mixed feed across all projects, newest first.
  const activity: ActivityItem[] = [
    ...updates.filter((u) => liveIds.has(u.project_id)).map<ActivityItem>((u) => ({
      id: `update-${u.id}`,
      kind: "update",
      projectId: u.project_id,
      projectName: nameOf.get(u.project_id) ?? "",
      at: u.created_at,
      actor: u.author_name,
      title: u.text,
    })),
    ...livePayments.slice(0, 8).map<ActivityItem>((p) => ({
      id: `payment-${p.id}`,
      kind: "payment",
      projectId: p.project_id,
      projectName: nameOf.get(p.project_id) ?? "",
      at: p.created_at,
      actor: p.created_by_name,
      title: p.reference || (p.side === "contractor" ? "Payment received" : "Payment made"),
      amount: Number(p.amount),
      status: p.status,
    })),
    ...liveExpenses.slice(0, 8).map<ActivityItem>((e) => ({
      id: `expense-${e.id}`,
      kind: "expense",
      projectId: e.project_id,
      projectName: nameOf.get(e.project_id) ?? "",
      at: e.created_at,
      actor: e.created_by_name,
      title: e.vendor_note || e.category,
      amount: Number(e.amount),
      hidden: !e.client_visible,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const photos: FreshPhoto[] = [];
  for (const p of photoRows) {
    const url = photoUrl(p);
    if (url && liveIds.has(p.project_id) && photos.length < 8) {
      photos.push({ id: p.id, url, projectId: p.project_id, projectName: nameOf.get(p.project_id) ?? "" });
    }
  }

  return {
    projects,
    kpis: {
      active: live.filter((p) => p.status === "active").length,
      onHold: live.filter((p) => p.status === "on_hold").length,
      completed: live.filter((p) => p.status === "completed").length,
      received: live.reduce((s, p) => s + p.received, 0),
      pendingReceived: livePayments
        .filter((p) => p.status === "pending")
        .reduce((s, p) => s + Number(p.amount), 0),
      spent: live.reduce((s, p) => s + p.spent, 0),
      budget: live.reduce((s, p) => s + (p.budget ?? 0), 0),
      receivedSeries: months.map((m) => receivedByMonth.get(m) ?? 0),
      spentSeries: months.map((m) => spentByMonth.get(m) ?? 0),
    },
    attention,
    activity,
    photos,
  };
}
