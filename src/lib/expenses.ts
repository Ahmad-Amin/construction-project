import type { SupabaseClient } from "@supabase/supabase-js";

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
  created_at: string;
  updated_at: string;
};

export const EXPENSE_COLUMNS =
  "id, amount, expense_date, category, vendor_note, receipt_path, client_visible, created_by, created_by_name, created_at, updated_at";

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
    // More than a minute between saving and the last change means it was edited afterwards.
    edited: new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 60_000,
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
