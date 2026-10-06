import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpenseFilters } from "@/lib/expense-filters";

export const EXPENSE_CATEGORIES = [
  "material",
  "labour",
  "transport",
  "equipment",
  "subcontractor",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenseCategoryLabel: Record<ExpenseCategory, string> = {
  material: "Material",
  labour: "Labour",
  transport: "Transport",
  equipment: "Equipment",
  subcontractor: "Subcontractor",
  other: "Other",
};

export type ExpenseItem = {
  id: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  note: string;
  createdBy: string;
  createdByName: string;
  clientVisible: boolean;
  receiptPath: string | null;
  receiptUrl: string | null;
  edited: boolean;
};

type Row = {
  id: string;
  amount: number;
  expense_date: string;
  category: ExpenseCategory;
  vendor_note: string;
  receipt_path: string | null;
  client_visible: boolean;
  created_by: string;
  created_by_name: string;
  edited: boolean;
};

export const EXPENSE_COLUMNS =
  "id, amount, expense_date, category, vendor_note, receipt_path, client_visible, created_by, created_by_name, edited";

const SIGNED_URL_SECONDS = 60 * 60;

// Turns rows into items and swaps receipt paths for short-lived signed links.
// Receipts are private; storage RLS only signs the ones this user may see.
export async function toExpenseItems(supabase: SupabaseClient, rows: Row[]): Promise<ExpenseItem[]> {
  const paths = rows.flatMap((r) => (r.receipt_path ? [r.receipt_path] : []));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage
      .from("project-media")
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const u of data ?? []) {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    date: r.expense_date,
    category: r.category,
    note: r.vendor_note,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    clientVisible: r.client_visible,
    receiptPath: r.receipt_path,
    receiptUrl: (r.receipt_path && signed.get(r.receipt_path)) || null,
    // True only when the amount, date, category, note or receipt changed (not when it was shared).
    edited: r.edited,
  }));
}

export async function fetchExpenses(
  supabase: SupabaseClient,
  projectId: string,
  limit: number,
): Promise<ExpenseItem[]> {
  const { data } = await supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("project_id", projectId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return toExpenseItems(supabase, (data ?? []) as Row[]);
}

export type ExpenseTotals = { total: number; sharedTotal: number; count: number };

// Computed in the database as the signed-in user, so a homeowner's total
// only ever includes expenses shared with them.
export async function fetchExpenseTotals(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ExpenseTotals> {
  const { data } = await supabase.rpc("project_expense_totals", { p_project_id: projectId });
  const row = data?.[0];
  return {
    total: Number(row?.total ?? 0),
    sharedTotal: Number(row?.shared_total ?? 0),
    count: Number(row?.expense_count ?? 0),
  };
}

export type CategoryTotal = { category: ExpenseCategory; total: number; count: number };

export type ExpenseOverview = {
  // The expenses to list (after the category filter, capped).
  items: ExpenseItem[];
  // Spending by category for the chosen dates and visibility, largest first.
  breakdown: CategoryTotal[];
  total: number;
  sharedTotal: number;
  count: number;
  // How many expenses match every filter (the list may show fewer).
  matching: number;
};

const MAX_ROWS = 2000;

// One query for the chart and the list. It runs as the signed-in person, so the numbers can
// only ever cover expenses that person is allowed to see: a homeowner's chart contains only
// shared expenses.
export async function fetchExpenseOverview(
  supabase: SupabaseClient,
  projectId: string,
  filters: ExpenseFilters,
  listLimit: number,
): Promise<ExpenseOverview> {
  let query = supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("project_id", projectId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (filters.from) query = query.gte("expense_date", filters.from);
  if (filters.to) query = query.lte("expense_date", filters.to);
  if (filters.show === "shared") query = query.eq("client_visible", true);
  if (filters.show === "hidden") query = query.eq("client_visible", false);

  const rows = ((await query).data ?? []) as Row[];

  const totals = new Map<ExpenseCategory, CategoryTotal>();
  for (const r of rows) {
    const entry = totals.get(r.category) ?? { category: r.category, total: 0, count: 0 };
    entry.total += Number(r.amount);
    entry.count += 1;
    totals.set(r.category, entry);
  }

  const matchingRows = filters.category ? rows.filter((r) => r.category === filters.category) : rows;

  return {
    items: await toExpenseItems(supabase, matchingRows.slice(0, listLimit)),
    breakdown: [...totals.values()].sort((a, b) => b.total - a.total),
    total: rows.reduce((sum, r) => sum + Number(r.amount), 0),
    sharedTotal: rows.filter((r) => r.client_visible).reduce((sum, r) => sum + Number(r.amount), 0),
    count: rows.length,
    matching: matchingRows.length,
  };
}
