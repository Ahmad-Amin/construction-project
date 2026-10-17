import { notFound, redirect } from "next/navigation";
import { ExpenseForm } from "@/components/expense-form";
import { FormFrame, FormHeading } from "@/components/form-frame";
import { EXPENSE_COLUMNS, toExpenseItems } from "@/lib/expenses";
import { todayIn } from "@/lib/format";
import { getProjectAccess, getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

// The two expense forms, used both as full pages and inside the slide-over panel (`sheet`).
type ViewProps = { projectId: string; sheet?: boolean };

export async function NewExpenseView({ projectId: id, sheet }: ViewProps) {
  const project = await getProjectBasic(id);
  if (!project) notFound();

  // Homeowners and view-only staff can't record expenses; the rest of the company's team can.
  const viewer = await getViewer();
  if (!viewer?.company || viewer.company.id !== project.company_id || !(await getProjectAccess(id)).canWrite) {
    redirect(`/dashboard/projects/${id}/expenses`);
  }
  const today = todayIn(project.timeZone);

  return (
    <FormFrame sheet={sheet}>
      <FormHeading>Add expense</FormHeading>
      <ExpenseForm
        sheet={sheet}
        projectId={id}
        currency={project.currency}
        today={today}
        isOwner={viewer.company.role === "owner"}
        initial={{
          amount: "",
          date: today,
          category: "material",
          note: "",
          clientVisible: false,
          receiptPath: null,
          receiptUrl: null,
        }}
      />
    </FormFrame>
  );
}

export async function EditExpenseView({ projectId: id, expenseId, sheet }: ViewProps & { expenseId: string }) {
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  if (!viewer?.company || viewer.company.id !== project.company_id || !(await getProjectAccess(id)).canWrite) {
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
    <FormFrame sheet={sheet}>
      <FormHeading>Edit expense</FormHeading>
      <ExpenseForm
        sheet={sheet}
        projectId={id}
        currency={project.currency}
        expenseId={expenseId}
        today={todayIn(project.timeZone)}
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
    </FormFrame>
  );
}
