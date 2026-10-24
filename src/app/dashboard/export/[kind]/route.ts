import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toCsv, type Cell } from "@/lib/csv";
import { expenseCategoryLabel, type ExpenseCategory } from "@/lib/expenses";
import { lostReasonLabel, sourceLabel, workTypeLabel } from "@/lib/leads";
import { dayInZone, todayIn } from "@/lib/format";
import { overallProgress } from "@/lib/project";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

const LIMIT = 10_000;
const KINDS = ["projects", "milestones", "updates", "expenses", "payments", "leads"] as const;
type Kind = (typeof KINDS)[number];

const yesNo = (value: boolean) => (value ? "Yes" : "No");

type Built = { headers: string[]; rows: Cell[][] };

async function projectNames(supabase: SupabaseClient) {
  const { data } = await supabase.from("projects").select("id, name").limit(LIMIT);
  return new Map((data ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
}

async function build(kind: Kind, supabase: SupabaseClient, currency: string, timeZone: string): Promise<Built> {
  const dayOf = (iso: string | null) => (iso ? dayInZone(iso, timeZone) : "");
  if (kind === "projects" || kind === "milestones") {
    const { data } = await supabase
      .from("projects")
      .select(
        "name, location, status, start_date, expected_completion_date, client:clients(name, email, phone), budget:project_budgets(amount, visible_to_client), milestones(name, status, progress_percent, position)",
      )
      .order("created_at", { ascending: true })
      .limit(LIMIT);
    type Row = {
      name: string;
      location: string;
      status: string;
      start_date: string | null;
      expected_completion_date: string | null;
      client: { name: string; email: string; phone: string | null } | { name: string; email: string; phone: string | null }[] | null;
      budget: { amount: number; visible_to_client: boolean } | { amount: number; visible_to_client: boolean }[] | null;
      milestones: { name: string; status: string; progress_percent: number; position: number }[];
    };
    const rows = (data ?? []) as Row[];

    if (kind === "projects") {
      return {
        headers: ["Project", "Location", "Status", "Start date", "Expected completion", "Overall progress %", "Client name", "Client email", "Client phone", `Budget (${currency})`, "Budget shown to client"],
        rows: rows.map((p) => {
          const client = one(p.client);
          const budget = one(p.budget);
          return [
            p.name, p.location, p.status, p.start_date, p.expected_completion_date,
            overallProgress(p.milestones), client?.name, client?.email, client?.phone,
            budget?.amount ?? null, budget ? yesNo(budget.visible_to_client) : "",
          ];
        }),
      };
    }
    return {
      headers: ["Project", "Milestone", "Status", "Progress %"],
      rows: rows.flatMap((p) =>
        [...p.milestones]
          .sort((a, b) => a.position - b.position)
          .map((m) => [p.name, m.name, m.status, m.progress_percent] as Cell[]),
      ),
    };
  }

  if (kind === "leads") {
    const [{ data }, { data: stages }] = await Promise.all([
      supabase
        .from("leads")
        .select("name, phone, email, location, work_type, size, budget, source, status, stage_id, lost_reason, follow_up_on, follow_up_note, notes, created_at, closed_at")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase.from("lead_stages").select("id, name"),
    ]);
    const stageOf = new Map(((stages ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
    type Row = {
      name: string;
      phone: string | null;
      email: string | null;
      location: string;
      work_type: string;
      size: string;
      budget: number | null;
      source: string;
      status: "open" | "won" | "lost";
      stage_id: string;
      lost_reason: string | null;
      follow_up_on: string | null;
      follow_up_note: string;
      notes: string;
      created_at: string;
      closed_at: string | null;
    };
    return {
      headers: ["Name", "Phone", "Email", "Location", "Type of work", "Size", `Rough budget (${currency})`, "Found you through", "Status", "Stage", "Lost because", "Follow up on", "Follow-up note", "Notes", "Added on", "Closed on"],
      rows: ((data ?? []) as Row[]).map((l) => [
        l.name, l.phone, l.email, l.location, workTypeLabel(l.work_type), l.size, l.budget === null ? null : Number(l.budget),
        sourceLabel(l.source), l.status === "open" ? "Open" : l.status === "won" ? "Won" : "Lost", stageOf.get(l.stage_id) ?? "",
        lostReasonLabel(l.lost_reason), l.follow_up_on, l.follow_up_note, l.notes, dayOf(l.created_at), dayOf(l.closed_at),
      ]),
    };
  }

  const names = await projectNames(supabase);
  const nameOf = (id: string) => names.get(id) ?? "";

  if (kind === "updates") {
    const { data } = await supabase
      .from("project_updates")
      .select("project_id, update_date, author_name, text, milestone:milestones(name), project_photos(id)")
      .order("update_date", { ascending: false })
      .limit(LIMIT);
    type Row = {
      project_id: string;
      update_date: string;
      author_name: string;
      text: string;
      milestone: { name: string } | { name: string }[] | null;
      project_photos: { id: string }[];
    };
    return {
      headers: ["Project", "Date", "Posted by", "Milestone", "Update", "Photos"],
      rows: ((data ?? []) as Row[]).map((u) => [
        nameOf(u.project_id), u.update_date, u.author_name, one(u.milestone)?.name, u.text, u.project_photos.length,
      ]),
    };
  }

  if (kind === "expenses") {
    const { data } = await supabase
      .from("expenses")
      .select("project_id, expense_date, category, vendor_note, amount, client_visible, receipt_path, created_by_name")
      .order("expense_date", { ascending: false })
      .limit(LIMIT);
    type Row = {
      project_id: string;
      expense_date: string;
      category: ExpenseCategory;
      vendor_note: string;
      amount: number;
      client_visible: boolean;
      receipt_path: string | null;
      created_by_name: string;
    };
    return {
      headers: ["Project", "Date", "Category", "Vendor or note", `Amount (${currency})`, "Shown to client", "Receipt attached", "Added by"],
      rows: ((data ?? []) as Row[]).map((e) => [
        nameOf(e.project_id), e.expense_date, expenseCategoryLabel[e.category] ?? e.category, e.vendor_note,
        Number(e.amount), yesNo(e.client_visible), yesNo(!!e.receipt_path), e.created_by_name,
      ]),
    };
  }

  const { data } = await supabase
    .from("payments")
    .select("project_id, payment_date, amount, side, status, reference, note, created_by_name, responded_by_name, responded_at, dispute_reason, receipt_path")
    .order("payment_date", { ascending: false })
    .limit(LIMIT);
  type Row = {
    project_id: string;
    payment_date: string;
    amount: number;
    side: "contractor" | "client";
    status: string;
    reference: string;
    note: string;
    created_by_name: string;
    responded_by_name: string;
    responded_at: string | null;
    dispute_reason: string | null;
    receipt_path: string | null;
  };
  return {
    headers: ["Project", "Date", `Amount (${currency})`, "Recorded by", "Recorded as", "Status", "Reference", "Note", "Confirmed or disputed by", "Responded on", "Dispute reason", "Receipt attached"],
    rows: ((data ?? []) as Row[]).map((p) => [
      nameOf(p.project_id), p.payment_date, Number(p.amount), p.created_by_name,
      p.side === "contractor" ? "Contractor" : "Homeowner", p.status, p.reference, p.note,
      p.responded_by_name, dayOf(p.responded_at), p.dispute_reason, yesNo(!!p.receipt_path),
    ]),
  };
}

// Owner-only download of the company's records as a spreadsheet-friendly CSV.
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "Unknown export." }, { status: 404 });
  }

  const viewer = await getViewer();
  if (viewer?.company?.role !== "owner") {
    return NextResponse.json({ error: "Only the company owner can export data." }, { status: 403 });
  }

  // Row-level security keeps this to the owner's own company.
  const supabase = await createClient();
  const { headers, rows } = await build(kind as Kind, supabase, viewer.company.currency, viewer.company.timeZone);

  const slug = viewer.company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
  const date = todayIn(viewer.company.timeZone);

  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-${kind}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
