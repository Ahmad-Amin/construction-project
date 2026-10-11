import { notFound, redirect } from "next/navigation";
import { DocumentForm } from "@/components/document-form";
import { FormFrame, FormHeading } from "@/components/form-frame";
import { DOCUMENT_COLUMNS, toDocumentItem } from "@/lib/documents";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

// The two document forms, used both as full pages and inside the slide-over panel (`sheet`).
type ViewProps = { projectId: string; sheet?: boolean };

export async function NewDocumentView({ projectId: id, sheet }: ViewProps) {
  const project = await getProjectBasic(id);
  if (!project) notFound();

  // Homeowners only read documents; the company's team adds them.
  const viewer = await getViewer();
  if (!viewer?.company || viewer.company.id !== project.company_id) {
    redirect(`/dashboard/projects/${id}/documents`);
  }

  return (
    <FormFrame sheet={sheet}>
      <FormHeading>Add document</FormHeading>
      <DocumentForm
        sheet={sheet}
        projectId={id}
        isOwner={viewer.company.role === "owner"}
        initial={{ title: "", category: "other", clientVisible: viewer.company.role === "owner" }}
      />
    </FormFrame>
  );
}

export async function EditDocumentView({ projectId: id, documentId, sheet }: ViewProps & { documentId: string }) {
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  if (!viewer?.company || viewer.company.id !== project.company_id) {
    redirect(`/dashboard/projects/${id}/documents`);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("project_documents")
    .select(DOCUMENT_COLUMNS)
    .eq("id", documentId)
    .eq("project_id", id)
    .maybeSingle();
  if (!data) notFound();

  const doc = toDocumentItem(data);
  const isOwner = viewer.company.role === "owner";
  // Staff can only edit what they added themselves.
  if (!isOwner && doc.createdBy !== viewer.userId) redirect(`/dashboard/projects/${id}/documents`);

  return (
    <FormFrame sheet={sheet}>
      <FormHeading>Edit document</FormHeading>
      <DocumentForm
        sheet={sheet}
        projectId={id}
        documentId={documentId}
        isOwner={isOwner}
        existingFile={{ name: doc.fileName || doc.title, size: doc.fileSize }}
        initial={{ title: doc.title, category: doc.category, clientVisible: doc.clientVisible }}
      />
    </FormFrame>
  );
}
