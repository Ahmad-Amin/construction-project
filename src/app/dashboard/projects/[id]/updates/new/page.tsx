import { NewUpdateView } from "@/components/update-views";

export const metadata = { title: "Add update" };

export default async function NewUpdatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewUpdateView projectId={id} />;
}
