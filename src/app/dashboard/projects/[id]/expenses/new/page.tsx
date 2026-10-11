import { NewExpenseView } from "@/components/expense-views";

export const metadata = { title: "Add expense" };

export default async function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewExpenseView projectId={id} />;
}
