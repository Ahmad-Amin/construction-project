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

  // The contractor's team and the project's homeowner can add documents. Row-level security stops anyone else.
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const isTeam = !!viewer.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer.company?.role === "owner";

  return (
    <FormFrame sheet={sheet}>
      <FormHeading>Add document</FormHeading>
      <DocumentForm
        sheet={sheet}
        projectId={id}
        role={isTeam ? (isOwner ? "owner" : "staff") : "client"}
        initial={{ title: "", category: "other", clientVisible: isOwner, teamVisible: true }}
      />
    </FormFrame>
  );
}

export async function EditDocumentView({ projectId: id, documentId, sheet }: ViewProps & { documentId: string }) {
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const isTeam = !!viewer.company && viewer.company.id === project.company_id;

  const supabase = await createClient();
  const { data } = await supabase
    .from("project_documents")
    .select(DOCUMENT_COLUMNS)
    .eq("id", documentId)
    .eq("project_id", id)
    .maybeSingle();
  if (!data) notFound();

  const doc = toDocumentItem(data);
  const isOwner = isTeam && viewer.company?.role === "owner";
  const back = `/dashboard/projects/${id}/documents`;

  if (!isTeam) {
    // A homeowner edits only the documents they added themselves.
    if (!doc.fromClient || doc.createdBy !== viewer.userId) redirect(back);
  } else {
    // The team can't edit what the homeowner added. Staff can only edit what they added themselves.
    if (doc.fromClient) redirect(back);
    if (!isOwner && doc.createdBy !== viewer.userId) redirect(back);
  }

  return (
    <FormFrame sheet={sheet}>
      <FormHeading>Edit document</FormHeading>
      <DocumentForm
        sheet={sheet}
        projectId={id}
        documentId={documentId}
        role={isTeam ? (isOwner ? "owner" : "staff") : "client"}
        existingFile={{ name: doc.fileName || doc.title, size: doc.fileSize }}
        initial={{ title: doc.title, category: doc.category, clientVisible: doc.clientVisible, teamVisible: doc.teamVisible }}
      />
    </FormFrame>
  );
}
