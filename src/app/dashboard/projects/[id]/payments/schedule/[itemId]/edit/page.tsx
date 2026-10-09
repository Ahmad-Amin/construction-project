import { EditScheduleView } from "@/components/payment-views";

export const metadata = { title: "Edit instalment" };

export default async function EditScheduleItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  return <EditScheduleView projectId={id} itemId={itemId} />;
}
