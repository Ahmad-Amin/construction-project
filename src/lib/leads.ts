import type { SupabaseClient } from "@supabase/supabase-js";
import type { Viewer } from "@/lib/viewer";

// Leads: the enquiries a contractor is working on before they become projects. The database decides who sees and
// changes them (migration 50); these are the shapes, the words, and the date sums the screens share.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LeadStatus = "open" | "won" | "lost";
// The palette an owner picks each stage's colour from (Settings → Leads). The names are what the database stores
// (migration 51 has the same list); each works on light and dark screens.
export const STAGE_COLORS = [
  { id: "sky", label: "Sky", hex: "#0ea5e9" },
  { id: "violet", label: "Violet", hex: "#8b5cf6" },
  { id: "amber", label: "Amber", hex: "#f59e0b" },
  { id: "emerald", label: "Emerald", hex: "#10b981" },
  { id: "rose", label: "Rose", hex: "#f43f5e" },
  { id: "teal", label: "Teal", hex: "#14b8a6" },
  { id: "indigo", label: "Indigo", hex: "#6366f1" },
  { id: "lime", label: "Lime", hex: "#84cc16" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "orange", label: "Orange", hex: "#f97316" },
  { id: "slate", label: "Slate", hex: "#64748b" },
  { id: "stone", label: "Stone", hex: "#a8a29e" },
] as const;
export type StageColor = (typeof STAGE_COLORS)[number]["id"];
export const isStageColor = (v: unknown): v is StageColor => STAGE_COLORS.some((c) => c.id === v);
export const stageHex = (color: StageColor) => STAGE_COLORS.find((c) => c.id === color)!.hex;

export type LeadStage = { id: string; name: string; position: number; color: StageColor };

export const WORK_TYPES = [
  { id: "new-house", label: "New house" },
  { id: "extra-floor", label: "Extra floor or extension" },
  { id: "renovation", label: "Renovation" },
  { id: "fit-out", label: "Shop or office fit-out" },
  { id: "other", label: "Other work" },
] as const;
export type WorkType = (typeof WORK_TYPES)[number]["id"];

export const LEAD_SOURCES = [
  { id: "referral", label: "Referral" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "google", label: "Google" },
  { id: "website", label: "Website" },
  { id: "site-board", label: "Site board" },
  { id: "walk-in", label: "Walk-in" },
  { id: "other", label: "Other" },
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number]["id"];

export const LOST_REASONS = [
  { id: "price", label: "Price" },
  { id: "another-contractor", label: "Went with another contractor" },
  { id: "timing", label: "Timing" },
  { id: "no-reply", label: "No reply" },
  { id: "other", label: "Other" },
] as const;
export type LostReason = (typeof LOST_REASONS)[number]["id"];

const labelIn = (list: readonly { id: string; label: string }[], id: string | null | undefined) => list.find((x) => x.id === id)?.label ?? "";
export const workTypeLabel = (id: string | null | undefined) => labelIn(WORK_TYPES, id);
export const sourceLabel = (id: string | null | undefined) => labelIn(LEAD_SOURCES, id);
export const lostReasonLabel = (id: string | null | undefined) => labelIn(LOST_REASONS, id);

export const isWorkType = (v: string): v is WorkType => WORK_TYPES.some((t) => t.id === v);
export const isLeadSource = (v: string): v is LeadSource => LEAD_SOURCES.some((s) => s.id === v);
export const isLostReason = (v: string): v is LostReason => LOST_REASONS.some((r) => r.id === v);

export type Lead = {
  id: string;
  stageId: string;
  status: LeadStatus;
  name: string;
  phone: string | null;
  email: string | null;
  location: string;
  workType: WorkType | "";
  size: string;
  budget: number | null;
  source: LeadSource | "";
  notes: string;
  followUpOn: string | null;
  followUpNote: string;
  followUpBy: string | null;
  lostReason: LostReason | null;
  projectId: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadEvent = {
  id: string;
  kind: "created" | "note" | "stage" | "won" | "lost" | "reopened" | "project";
  body: string;
  createdAt: string;
  by: string | null;
};

const LEAD_COLUMNS =
  "id, stage_id, status, name, phone, email, location, work_type, size, budget, source, notes, follow_up_on, follow_up_note, follow_up_by, lost_reason, project_id, closed_at, created_at, updated_at";

type LeadRow = {
  id: string;
  stage_id: string;
  status: LeadStatus;
  name: string;
  phone: string | null;
  email: string | null;
  location: string;
  work_type: string;
  size: string;
  budget: number | string | null;
  source: string;
  notes: string;
  follow_up_on: string | null;
  follow_up_note: string;
  follow_up_by: string | null;
  lost_reason: string | null;
  project_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

const toLead = (r: LeadRow): Lead => ({
  id: r.id,
  stageId: r.stage_id,
  status: r.status,
  name: r.name,
  phone: r.phone,
  email: r.email,
  location: r.location,
  workType: isWorkType(r.work_type) ? r.work_type : "",
  size: r.size,
  budget: r.budget === null ? null : Number(r.budget),
  source: isLeadSource(r.source) ? r.source : "",
  notes: r.notes,
  followUpOn: r.follow_up_on,
  followUpNote: r.follow_up_note,
  followUpBy: r.follow_up_by,
  lostReason: r.lost_reason && isLostReason(r.lost_reason) ? r.lost_reason : null,
  projectId: r.project_id,
  closedAt: r.closed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// ---------------------------------------------------------------------------
// Who may use leads (the database enforces the same rules; these decide what the screens offer)
// ---------------------------------------------------------------------------
export function leadAccess(viewer: Viewer | null): { see: boolean; change: boolean; owner: boolean } {
  const company = viewer?.company;
  if (!company) return { see: false, change: false, owner: false };
  if (company.role === "owner") return { see: true, change: true, owner: true };
  const staff = company.staff;
  const see = !!staff && staff.canSeeLeads && !staff.paused;
  return { see, change: see && !staff!.viewOnly, owner: false };
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
// Every column, so this keeps working while the database and the app are updated one after the other; a stage without
// a colour yet (before migration 51) gets one from the palette by its place.
export async function fetchLeadStages(supabase: SupabaseClient): Promise<LeadStage[]> {
  const { data } = await supabase.from("lead_stages").select("*").order("position").order("created_at");
  return ((data ?? []) as { id: string; name: string; position: number; color?: string }[]).map((s, i) => ({
    id: s.id,
    name: s.name,
    position: s.position,
    color: isStageColor(s.color) ? s.color : STAGE_COLORS[i % STAGE_COLORS.length].id,
  }));
}

// Every lead of the company: open ones, and closed ones from the last year (the Won and Lost lists).
export async function fetchLeads(supabase: SupabaseClient): Promise<Lead[]> {
  const since = new Date(Date.now() - 366 * 86_400_000).toISOString();
  const [open, closed] = await Promise.all([
    supabase.from("leads").select(LEAD_COLUMNS).eq("status", "open").order("updated_at", { ascending: false }).limit(2000),
    supabase.from("leads").select(LEAD_COLUMNS).neq("status", "open").gte("closed_at", since).order("closed_at", { ascending: false }).limit(1000),
  ]);
  return [...((open.data ?? []) as LeadRow[]), ...((closed.data ?? []) as LeadRow[])].map(toLead);
}

export async function fetchLead(supabase: SupabaseClient, id: string): Promise<Lead | null> {
  if (!UUID.test(id)) return null;
  const { data } = await supabase.from("leads").select(LEAD_COLUMNS).eq("id", id).maybeSingle();
  return data ? toLead(data as LeadRow) : null;
}

// A lead's history, newest first, with who did each thing.
export async function fetchLeadEvents(supabase: SupabaseClient, leadId: string): Promise<LeadEvent[]> {
  const { data } = await supabase
    .from("lead_events")
    .select("id, kind, body, created_at, created_by")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as { id: string; kind: LeadEvent["kind"]; body: string; created_at: string; created_by: string | null }[];
  const people = [...new Set(rows.map((r) => r.created_by).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (people.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", people);
    for (const p of (profiles ?? []) as { id: string; name: string | null }[]) if (p.name?.trim()) names.set(p.id, p.name.trim());
  }
  return rows.map((r) => ({ id: r.id, kind: r.kind, body: r.body, createdAt: r.created_at, by: r.created_by ? names.get(r.created_by) ?? null : null }));
}

// The signed-in person's follow-ups due today and overdue (the Leads badge and the dashboard card).
export async function fetchMyFollowUps(supabase: SupabaseClient): Promise<{ today: number; overdue: number }> {
  const { data } = await supabase.rpc("my_lead_follow_ups");
  const row = ((data ?? []) as { due_today: number; overdue: number }[])[0];
  return { today: row?.due_today ?? 0, overdue: row?.overdue ?? 0 };
}

// ---------------------------------------------------------------------------
// Follow-up dates (plain calendar days, in the company's time zone)
// ---------------------------------------------------------------------------
export function addDays(day: string, days: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export type FollowUpState = "overdue" | "today" | "soon" | "later";

export function followUpState(day: string | null, today: string): FollowUpState | null {
  if (!day) return null;
  if (day < today) return "overdue";
  if (day === today) return "today";
  return day <= addDays(today, 6) ? "soon" : "later";
}

// "Today", "Tomorrow", "Overdue · 2 Oct", "Fri", "25 Oct".
export function followUpLabel(day: string, today: string) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const short = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  if (day < today) return `Overdue · ${short}`;
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  if (day <= addDays(today, 6)) return date.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  return day.slice(0, 4) === today.slice(0, 4) ? short : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// The quick choices offered when setting a follow-up.
export const followUpChoices = (today: string) => [
  { label: "Today", day: today },
  { label: "Tomorrow", day: addDays(today, 1) },
  { label: "In 3 days", day: addDays(today, 3) },
  { label: "Next week", day: addDays(today, 7) },
];

// ---------------------------------------------------------------------------
// The look of the pipeline
// ---------------------------------------------------------------------------
// "HA" for Hassan Ahmad, "S" for Sara.
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w[0] ?? ""));
  if (words.length === 0) return "?";
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0][0]).toUpperCase();
}

// The numbers at the top of the leads page. Won and lost count the last 90 days, so the win rate reflects how things
// are going now.
export type LeadStats = { open: number; addedThisWeek: number; pipeline: number; withBudget: number; dueToday: number; overdue: number; won: number; lost: number };

export function leadStats(leads: Lead[], today: string, now = Date.now()): LeadStats {
  const open = leads.filter((l) => l.status === "open");
  const recent = (iso: string | null, days: number) => !!iso && now - Date.parse(iso) <= days * 86_400_000;
  const budgets = open.filter((l) => l.budget !== null);
  return {
    open: open.length,
    addedThisWeek: open.filter((l) => recent(l.createdAt, 7)).length,
    pipeline: budgets.reduce((sum, l) => sum + (l.budget ?? 0), 0),
    withBudget: budgets.length,
    dueToday: open.filter((l) => l.followUpOn === today).length,
    overdue: open.filter((l) => !!l.followUpOn && l.followUpOn < today).length,
    won: leads.filter((l) => l.status === "won" && recent(l.closedAt, 90)).length,
    lost: leads.filter((l) => l.status === "lost" && recent(l.closedAt, 90)).length,
  };
}
