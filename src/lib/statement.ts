import type { SupabaseClient } from "@supabase/supabase-js";
import { expenseCategoryLabel, type ExpenseCategory } from "@/lib/expenses";
import { todayInKarachi } from "@/lib/format";
import type { PaymentSide, PaymentStatus } from "@/lib/payments";
import { overallProgress } from "@/lib/project";
import { one, type MilestoneStatus, type ProjectStatus } from "@/lib/types";

export type StatementData = {
  generatedOn: string;
  company: { name: string; logo: Buffer | null };
  project: {
    name: string;
    location: string;
    status: ProjectStatus;
    startDate: string | null;
    expectedCompletion: string | null;
  };
  clientName: string | null;
  progress: number;
  milestones: { name: string; percent: number; status: MilestoneStatus }[];
  // Null unless the owner has chosen to share the budget with the client.
  budget: number | null;
  money: {
    received: number;
    pending: number;
    disputedCount: number;
    expensesTotal: number;
    expensesCount: number;
  };
  payments: {
    date: string;
    reference: string;
    amount: number;
    status: PaymentStatus;
    side: PaymentSide;
    by: string;
    respondedBy: string;
    respondedAt: string | null;
  }[];
  expenses: { date: string; category: string; note: string; amount: number; receipt: boolean }[];
  expensesByCategory: { category: string; total: number }[];
  updates: { date: string; text: string; author: string; milestone: string | null; photos: number }[];
  photos: { image: Buffer; date: string }[];
};

const MAX_UPDATES = 8;
const MAX_PHOTOS = 6;
const MAX_ROWS = 60;

async function download(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

// Builds the statement exactly as the client would see the project, whoever asks for it.
// The owner can safely send it: expenses not shared with the client are left out, and the
// budget appears only if it has been shared. (For a homeowner, row-level security agrees.)
export async function buildStatement(
  supabase: SupabaseClient,
  projectId: string,
  company: { name: string; logoUrl: string | null },
): Promise<StatementData | null> {
  const [projectRes, paymentsRes, expensesRes, updatesRes, photosRes] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "name, location, status, start_date, expected_completion_date, client:clients(name), budget:project_budgets(amount, visible_to_client), milestones(name, status, progress_percent, position)",
      )
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("payment_date, reference, amount, status, side, created_by_name, responded_by_name, responded_at")
      .eq("project_id", projectId)
      .order("payment_date", { ascending: true })
      .limit(MAX_ROWS),
    supabase
      .from("expenses")
      .select("expense_date, category, vendor_note, amount, receipt_path")
      .eq("project_id", projectId)
      .eq("client_visible", true)
      .order("expense_date", { ascending: true })
      .limit(500),
    supabase
      .from("project_updates")
      .select("update_date, text, author_name, milestone:milestones(name), project_photos(id)")
      .eq("project_id", projectId)
      .order("update_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MAX_UPDATES),
    supabase
      .from("project_photos")
      .select("storage_path, created_at, update:project_updates(update_date)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(MAX_PHOTOS),
  ]);

  const p = projectRes.data as
    | {
        name: string;
        location: string;
        status: ProjectStatus;
        start_date: string | null;
        expected_completion_date: string | null;
        client: { name: string } | { name: string }[] | null;
        budget: { amount: number; visible_to_client: boolean } | { amount: number; visible_to_client: boolean }[] | null;
        milestones: { name: string; status: MilestoneStatus; progress_percent: number; position: number }[];
      }
    | null;
  if (!p) return null;

  const budget = one(p.budget);
  const milestones = [...p.milestones].sort((a, b) => a.position - b.position);

  type PaymentRow = {
    payment_date: string;
    reference: string;
    amount: number;
    status: PaymentStatus;
    side: PaymentSide;
    created_by_name: string;
    responded_by_name: string;
    responded_at: string | null;
  };
  const payments = ((paymentsRes.data ?? []) as PaymentRow[]).map((x) => ({
    date: x.payment_date,
    reference: x.reference,
    amount: Number(x.amount),
    status: x.status,
    side: x.side,
    by: x.created_by_name,
    respondedBy: x.responded_by_name,
    respondedAt: x.responded_at,
  }));

  type ExpenseRow = {
    expense_date: string;
    category: ExpenseCategory;
    vendor_note: string;
    amount: number;
    receipt_path: string | null;
  };
  const expenseRows = (expensesRes.data ?? []) as ExpenseRow[];
  const byCategory = new Map<string, number>();
  for (const e of expenseRows) {
    const label = expenseCategoryLabel[e.category] ?? e.category;
    byCategory.set(label, (byCategory.get(label) ?? 0) + Number(e.amount));
  }

  type UpdateRow = {
    update_date: string;
    text: string;
    author_name: string;
    milestone: { name: string } | { name: string }[] | null;
    project_photos: { id: string }[];
  };

  // Photos and the logo are fetched now so the PDF is a single self-contained file.
  type PhotoRow = { storage_path: string; update: { update_date: string } | { update_date: string }[] | null };
  const photoRows = (photosRes.data ?? []) as PhotoRow[];
  const signed = photoRows.length
    ? await supabase.storage.from("project-media").createSignedUrls(
        photoRows.map((r) => r.storage_path),
        300,
      )
    : { data: [] };
  const photoUrls = new Map((signed.data ?? []).map((u) => [u.path, u.signedUrl]));
  const [logo, ...images] = await Promise.all([
    company.logoUrl ? download(company.logoUrl) : Promise.resolve(null),
    ...photoRows.map((r) => {
      const url = photoUrls.get(r.storage_path);
      return url ? download(url) : Promise.resolve(null);
    }),
  ]);
  const photos = photoRows.flatMap((r, i) => {
    const image = images[i];
    return image ? [{ image, date: one(r.update)?.update_date ?? "" }] : [];
  });

  return {
    generatedOn: todayInKarachi(),
    company: { name: company.name, logo },
    project: {
      name: p.name,
      location: p.location,
      status: p.status,
      startDate: p.start_date,
      expectedCompletion: p.expected_completion_date,
    },
    clientName: one(p.client)?.name ?? null,
    progress: overallProgress(milestones.map((m) => ({ progress_percent: m.progress_percent }))),
    milestones: milestones.map((m) => ({ name: m.name, percent: m.progress_percent, status: m.status })),
    budget: budget?.visible_to_client ? budget.amount : null,
    money: {
      received: payments.filter((x) => x.status === "confirmed").reduce((s, x) => s + x.amount, 0),
      pending: payments.filter((x) => x.status === "pending").reduce((s, x) => s + x.amount, 0),
      disputedCount: payments.filter((x) => x.status === "disputed").length,
      expensesTotal: expenseRows.reduce((s, e) => s + Number(e.amount), 0),
      expensesCount: expenseRows.length,
    },
    payments,
    expenses: expenseRows.map((e) => ({
      date: e.expense_date,
      category: expenseCategoryLabel[e.category] ?? e.category,
      note: e.vendor_note,
      amount: Number(e.amount),
      receipt: !!e.receipt_path,
    })),
    expensesByCategory: [...byCategory.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
    updates: ((updatesRes.data ?? []) as UpdateRow[]).map((u) => ({
      date: u.update_date,
      text: u.text,
      author: u.author_name,
      milestone: one(u.milestone)?.name ?? null,
      photos: u.project_photos.length,
    })),
    photos,
  };
}
