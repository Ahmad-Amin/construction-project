import { NewPaymentView } from "@/components/payment-views";

export const metadata = { title: "Record payment" };

export default async function NewPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ for?: string }>;
}) {
  const { id } = await params;
  const { for: forItem } = await searchParams;
  return <NewPaymentView projectId={id} forItem={forItem} />;
}
