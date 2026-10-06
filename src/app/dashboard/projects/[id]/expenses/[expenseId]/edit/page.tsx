import { notFound, redirect } from "next/navigation";
import { ExpenseForm } from "@/components/expense-form";
import { EXPENSE_COLUMNS, toExpenseItems } from "@/lib/expenses";
import { todayInKarachi } from "@/lib/format";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Edit expense" };

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  if (!viewer?.company || viewer.company.id !== project.company_id) {
    redirect(`/dashboard/projects/${id}/expenses`);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("id", expenseId)
    .eq("project_id", id)
    .maybeSingle();
  if (!data) notFound();

  const [expense] = await toExpenseItems(supabase, [data]);
  const isOwner = viewer.company.role === "owner";
  // Staff can only edit what they entered themselves.
  if (!isOwner && expense.createdBy !== viewer.userId) {
    redirect(`/dashboard/projects/${id}/expenses`);
  }

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold tracking-tight">Edit expense</h2>
      <ExpenseForm
        projectId={id}
        expenseId={expenseId}
        today={todayInKarachi()}
        isOwner={isOwner}
        initial={{
          amount: String(expense.amount),
          date: expense.date,
          category: expense.category,
          note: expense.note,
          clientVisible: expense.clientVisible,
          receiptPath: expense.receiptPath,
          receiptUrl: expense.receiptUrl,
        }}
      />
    </div>
  );
}
