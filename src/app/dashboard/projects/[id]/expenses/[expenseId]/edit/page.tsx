import { EditExpenseView } from "@/components/expense-views";

export const metadata = { title: "Edit expense" };

export default async function EditExpensePage({ params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const { id, expenseId } = await params;
  return <EditExpenseView projectId={id} expenseId={expenseId} />;
}
