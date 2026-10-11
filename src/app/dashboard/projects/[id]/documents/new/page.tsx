import { NewDocumentView } from "@/components/document-views";

export const metadata = { title: "Add document" };

export default async function NewDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewDocumentView projectId={id} />;
}
