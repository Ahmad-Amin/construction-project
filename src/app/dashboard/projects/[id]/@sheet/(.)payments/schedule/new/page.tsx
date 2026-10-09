import { NewScheduleView } from "@/components/payment-views";

export default async function NewScheduleSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewScheduleView projectId={id} sheet />;
}
