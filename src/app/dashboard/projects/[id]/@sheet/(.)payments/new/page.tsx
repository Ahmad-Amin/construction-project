import { NewPaymentView } from "@/components/payment-views";

export default async function NewPaymentSheet({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ for?: string; invoice?: string }>;
}) {
  const { id } = await params;
  const { for: forItem, invoice } = await searchParams;
  return <NewPaymentView projectId={id} forItem={forItem} forInvoice={invoice} sheet />;
}
