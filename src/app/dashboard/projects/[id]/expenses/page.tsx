import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Receipt } from "lucide-react";
import { ExpenseCard } from "@/components/expense-card";
import { fetchExpenses, fetchExpenseTotals } from "@/lib/expenses";
import { formatPKR } from "@/lib/format";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Expenses" };

const PAGE_SIZE = 100;

export default async function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";

  // RLS decides which expenses come back: the team gets all, a homeowner only shared ones.
  const supabase = await createClient();
  const [expenses, totals] = await Promise.all([
    fetchExpenses(supabase, id, PAGE_SIZE),
    fetchExpenseTotals(supabase, id),
  ]);

  return (
    <div>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <p className="text-sm text-muted">{isTeam ? "Total spent" : "Expenses shared with you"}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatPKR(totals.total)}</p>
        <p className="mt-1 text-sm text-muted">
          {totals.count} {totals.count === 1 ? "expense" : "expenses"}
          {isTeam && totals.count > 0 && ` · ${formatPKR(totals.sharedTotal)} shown to client`}
        </p>
      </section>

      <div className="mt-6 mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Expenses</h2>
        {isTeam && (
          <Link href={`/dashboard/projects/${id}/expenses/new`} className={button("primary", "sm")}>
            <Plus className="size-4" aria-hidden /> Add expense
          </Link>
        )}
      </div>

      {expenses.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Receipt className="size-6" aria-hidden />
          </span>
          <h3 className="mt-4 font-semibold">No expenses yet</h3>
          <p className="mt-1 max-w-xs text-sm text-muted">
            {isTeam
              ? "Record what you spend and attach the receipt. Only what you choose to share is shown to your client."
              : "Expenses your contractor shares with you will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((e) => (
            <ExpenseCard
              key={e.id}
              expense={e}
              projectId={id}
              isTeam={isTeam}
              isOwner={isOwner}
              canEdit={isOwner || (isTeam && e.createdBy === viewer?.userId)}
            />
          ))}
          {totals.count > PAGE_SIZE && (
            <p className="text-center text-sm text-muted">Showing the latest {PAGE_SIZE} expenses.</p>
          )}
        </div>
      )}
    </div>
  );
}
