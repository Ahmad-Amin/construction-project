import { EditPaymentView } from "@/components/payment-views";

export default async function EditPaymentSheet({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params;
  return <EditPaymentView projectId={id} paymentId={paymentId} sheet />;
}
