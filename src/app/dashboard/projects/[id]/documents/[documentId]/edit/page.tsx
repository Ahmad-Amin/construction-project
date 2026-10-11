import { EditDocumentView } from "@/components/document-views";

export const metadata = { title: "Edit document" };

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string; documentId: string }> }) {
  const { id, documentId } = await params;
  return <EditDocumentView projectId={id} documentId={documentId} />;
}
