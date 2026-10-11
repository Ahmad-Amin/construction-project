import { NewUpdateView } from "@/components/update-views";

export default async function NewUpdateSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewUpdateView projectId={id} sheet />;
}
