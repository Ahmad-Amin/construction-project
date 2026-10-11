import { NewExpenseView } from "@/components/expense-views";

export default async function NewExpenseSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewExpenseView projectId={id} sheet />;
}
