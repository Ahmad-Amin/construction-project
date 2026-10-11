import { NewDocumentView } from "@/components/document-views";

export default async function NewDocumentSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NewDocumentView projectId={id} sheet />;
}
