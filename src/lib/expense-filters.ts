import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/expenses";

export type Visibility = "all" | "shared" | "hidden";

export type ExpenseFilters = {
  from: string | null;
  to: string | null;
  category: ExpenseCategory | null;
  show: Visibility;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Reads the page's address parameters. Anything unrecognised is ignored, so a mistyped
// link just shows everything. Only the team can filter by visibility; for a homeowner
// that choice is meaningless (they only ever see shared expenses).
export function parseExpenseFilters(
  params: Record<string, string | undefined>,
  isTeam: boolean,
): ExpenseFilters {
  let from = params.from && DAY.test(params.from) ? params.from : null;
  let to = params.to && DAY.test(params.to) ? params.to : null;
  if (from && to && from > to) [from, to] = [to, from];

  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(params.category ?? "")
    ? (params.category as ExpenseCategory)
    : null;
  const show: Visibility =
    isTeam && (params.show === "shared" || params.show === "hidden") ? params.show : "all";

  return { from, to, category, show };
}

export function hasActiveFilters(f: ExpenseFilters) {
  return !!(f.from || f.to || f.category || f.show !== "all");
}

// A "?a=b" string for a filter set, with optional changes applied on top.
export function filtersToQuery(f: ExpenseFilters, changes: Partial<ExpenseFilters> = {}) {
  const next = { ...f, ...changes };
  const query = new URLSearchParams();
  if (next.from) query.set("from", next.from);
  if (next.to) query.set("to", next.to);
  if (next.category) query.set("category", next.category);
  if (next.show !== "all") query.set("show", next.show);
  const text = query.toString();
  return text ? `?${text}` : "";
}
