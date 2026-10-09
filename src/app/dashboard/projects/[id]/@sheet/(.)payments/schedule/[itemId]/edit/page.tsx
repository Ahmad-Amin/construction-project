import { EditScheduleView } from "@/components/payment-views";

export default async function EditScheduleSheet({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  return <EditScheduleView projectId={id} itemId={itemId} sheet />;
}
