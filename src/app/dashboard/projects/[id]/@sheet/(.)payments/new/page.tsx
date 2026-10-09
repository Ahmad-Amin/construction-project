import { NewPaymentView } from "@/components/payment-views";

export default async function NewPaymentSheet({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ for?: string }>;
}) {
  const { id } = await params;
  const { for: forItem } = await searchParams;
  return <NewPaymentView projectId={id} forItem={forItem} sheet />;
}
