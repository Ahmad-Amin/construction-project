import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Receipt } from "lucide-react";
import { ExpenseBreakdown } from "@/components/expense-breakdown";
import { ExpenseCard } from "@/components/expense-card";
import { ExpenseFilterBar } from "@/components/expense-filter-bar";
import { fetchExpenseOverview } from "@/lib/expenses";
import { filtersToQuery, hasActiveFilters, parseExpenseFilters } from "@/lib/expense-filters";
import { formatPKR, todayInKarachi } from "@/lib/format";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Expenses" };

const PAGE_SIZE = 100;

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";

  const filters = parseExpenseFilters(await searchParams, isTeam);
  const filtered = hasActiveFilters(filters);
  const base = `/dashboard/projects/${id}/expenses`;

  // RLS decides which expenses come back: the team gets all, a homeowner only shared ones.
  const supabase = await createClient();
  const overview = await fetchExpenseOverview(supabase, id, filters, PAGE_SIZE);

  const hasAnyExpenses = overview.count > 0 || filtered;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <p className="text-sm text-muted">
          {isTeam ? (filtered ? "Spent (filtered)" : "Total spent") : "Expenses shared with you"}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatPKR(overview.total)}</p>
        <p className="mt-1 text-sm text-muted">
          {overview.count} {overview.count === 1 ? "expense" : "expenses"}
          {isTeam && overview.count > 0 && ` · ${formatPKR(overview.sharedTotal)} shown to client`}
        </p>
      </section>

      {hasAnyExpenses && (
        <>
          <ExpenseFilterBar base={base} filters={filters} today={todayInKarachi()} isTeam={isTeam} />
          <ExpenseBreakdown
            breakdown={overview.breakdown}
            total={overview.total}
            selected={filters.category}
            hrefFor={(category) => `${base}${filtersToQuery(filters, { category })}`}
            title={isTeam ? "Where the money went" : "Where your money went"}
          />
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">
          Expenses
          {filtered && overview.count > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">{overview.matching} shown</span>
          )}
        </h2>
        {isTeam && (
          <Link href={`${base}/new`} className={button("primary", "sm")}>
            <Plus className="size-4" aria-hidden /> Add expense
          </Link>
        )}
      </div>

      {overview.items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Receipt className="size-6" aria-hidden />
          </span>
          <h3 className="mt-4 font-semibold">{filtered ? "No expenses match these filters" : "No expenses yet"}</h3>
          <p className="mt-1 max-w-xs text-sm text-muted">
            {filtered
              ? "Try a wider date range, or clear the filters."
              : isTeam
                ? "Record what you spend and attach the receipt. Only what you choose to share is shown to your client."
                : "Expenses your contractor shares with you will appear here."}
          </p>
          {filtered && (
            <Link href={base} className={`${button("secondary", "sm")} mt-5`}>
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {overview.items.map((e) => (
            <ExpenseCard
              key={e.id}
              expense={e}
              projectId={id}
              isTeam={isTeam}
              isOwner={isOwner}
              canEdit={isOwner || (isTeam && e.createdBy === viewer?.userId)}
            />
          ))}
          {overview.matching > PAGE_SIZE && (
            <p className="text-center text-sm text-muted">Showing the latest {PAGE_SIZE} expenses.</p>
          )}
        </div>
      )}
    </div>
  );
}
