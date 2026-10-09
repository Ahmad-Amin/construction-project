import { EditPaymentView } from "@/components/payment-views";

export const metadata = { title: "Edit payment" };

export default async function EditPaymentPage({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params;
  return <EditPaymentView projectId={id} paymentId={paymentId} />;
}
