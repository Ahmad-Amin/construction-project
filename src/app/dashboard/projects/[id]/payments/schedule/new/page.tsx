import { NewScheduleView } from "@/components/payment-views";

export const metadata = { title: "Add to payment schedule" };

export default async function NewScheduleItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewScheduleView projectId={id} />;
}
