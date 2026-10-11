import { EditExpenseView } from "@/components/expense-views";

export default async function EditExpenseSheet({ params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const { id, expenseId } = await params;
  return <EditExpenseView projectId={id} expenseId={expenseId} sheet />;
}
