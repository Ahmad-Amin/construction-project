import { EditDocumentView } from "@/components/document-views";

export default async function EditDocumentSheet({ params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id, documentId } = await params;
  return <EditDocumentView projectId={id} documentId={documentId} sheet />;
}
