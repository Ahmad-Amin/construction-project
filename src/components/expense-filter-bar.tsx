import Link from "next/link";
import { CalendarRange, X } from "lucide-react";
import { expenseCategoryLabel } from "@/lib/expenses";
import { filtersToQuery, hasActiveFilters, type ExpenseFilters, type Visibility } from "@/lib/expense-filters";
import { formatDate } from "@/lib/format";
import { button } from "@/lib/ui";

const day = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "UTC" });

// Date and visibility filters for the expense list. Plain links and a plain form, so it works
// without any script, and every filtered view has its own address you can share or bookmark.
export function ExpenseFilterBar({
  base,
  filters,
  today,
  isTeam,
}: {
  base: string;
  filters: ExpenseFilters;
  today: string; // yyyy-mm-dd, in Pakistan
  isTeam: boolean;
}) {
  const href = (changes: Partial<ExpenseFilters>) => `${base}${filtersToQuery(filters, changes)}`;

  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const last30 = day(new Date(new Date(`${today}T00:00:00Z`).getTime() - 30 * 86_400_000));

  const presets = [
    { label: "All time", changes: { from: null, to: null }, active: !filters.from && !filters.to },
    { label: "This month", changes: { from: monthStart, to: today }, active: filters.from === monthStart && filters.to === today },
    { label: "Last 30 days", changes: { from: last30, to: today }, active: filters.from === last30 && filters.to === today },
  ];
  const customActive = !!(filters.from || filters.to) && !presets.some((p) => p.active);

  const visibility: { value: Visibility; label: string }[] = [
    { value: "all", label: "All" },
    { value: "shared", label: "Shared with client" },
    { value: "hidden", label: "Hidden" },
  ];

  const chip = (active: boolean) =>
    `inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "border-primary bg-primary-soft" : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="size-4 text-muted" aria-hidden />
        {presets.map((p) => (
          <Link key={p.label} href={href(p.changes)} scroll={false} aria-current={p.active ? "true" : undefined} className={chip(p.active)}>
            {p.label}
          </Link>
        ))}
        <details className="group relative">
          <summary className={`${chip(customActive)} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            {customActive && filters.from && filters.to
              ? `${formatDate(filters.from)} to ${formatDate(filters.to)}`
              : "Custom range"}
          </summary>
          <form
            method="get"
            className="absolute left-0 z-10 mt-2 w-72 max-w-[85vw] space-y-3 rounded-xl border border-line bg-surface p-4 shadow-xl"
          >
            {filters.category && <input type="hidden" name="category" value={filters.category} />}
            {filters.show !== "all" && <input type="hidden" name="show" value={filters.show} />}
            <label className="block text-sm font-medium">
              From
              <input type="date" name="from" defaultValue={filters.from ?? ""} max={today} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base" />
            </label>
            <label className="block text-sm font-medium">
              To
              <input type="date" name="to" defaultValue={filters.to ?? ""} max={today} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-base" />
            </label>
            <button type="submit" className={`${button("primary", "sm")} w-full`}>Apply</button>
          </form>
        </details>
      </div>

      {isTeam && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Show</span>
          {visibility.map((v) => (
            <Link key={v.value} href={href({ show: v.value })} scroll={false} aria-current={filters.show === v.value ? "true" : undefined} className={chip(filters.show === v.value)}>
              {v.label}
            </Link>
          ))}
        </div>
      )}

      {hasActiveFilters(filters) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {filters.category && (
            <Link href={href({ category: null })} scroll={false} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 font-medium hover:bg-line">
              {expenseCategoryLabel[filters.category]} <X className="size-3.5" aria-hidden />
            </Link>
          )}
          <Link href={base} scroll={false} className="font-medium text-muted underline underline-offset-4 hover:text-foreground">
            Clear filters
          </Link>
        </div>
      )}
    </div>
  );
}
