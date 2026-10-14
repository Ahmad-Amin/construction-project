import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderOpen, Plus } from "lucide-react";
import { DocumentCard } from "@/components/document-card";
import { LinkPending } from "@/components/link-pending";
import { DOCUMENT_CATEGORIES, documentCategoryHeading, fetchDocuments } from "@/lib/documents";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";

  const documents = await fetchDocuments(await createClient(), id);
  const viewerIsClient = !isTeam;
  // The contractor's documents, grouped by type; the homeowner's own are kept apart.
  const contractorDocs = documents.filter((d) => !d.fromClient);
  const clientDocs = documents.filter((d) => d.fromClient);
  const shared = contractorDocs.filter((d) => d.clientVisible).length;

  const clientGroup = clientDocs.length > 0 && (
    <section aria-label={viewerIsClient ? "Added by you" : "From your client"}>
      <h3 className="mb-3 text-sm font-semibold text-muted">
        {viewerIsClient ? "Added by you" : "From your client"}
        <span className="ml-2 font-normal">{clientDocs.length}</span>
      </h3>
      <div className="space-y-3">
        {clientDocs.map((d) => (
          <DocumentCard
            key={d.id}
            document={d}
            projectId={id}
            timeZone={project.timeZone}
            isTeam={isTeam}
            isOwner={isOwner}
            canEdit={false}
            viewerIsClient={viewerIsClient}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">
          Documents
          {documents.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted">
              {isOwner ? `${documents.length} · ${shared} shared with your client` : documents.length}
            </span>
          )}
        </h2>
        <Link href={`/dashboard/projects/${id}/documents/new`} className={button("primary", "sm")}>
          <Plus className="size-4" aria-hidden /> Add document
          <LinkPending className="size-4" />
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <FolderOpen className="size-6" aria-hidden />
          </span>
          <h3 className="mt-4 font-semibold">No documents yet</h3>
          <p className="mt-1 max-w-xs text-sm text-muted">
            {isTeam
              ? "Keep the contract, drawings and permits in one place. You choose which ones your client can open. Your client can add documents for you too."
              : "The contract, drawings and permits your contractor shares with you will appear here. You can add your own documents too, and choose whether your contractor sees them."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {isTeam && clientGroup}
          {DOCUMENT_CATEGORIES.map((category) => {
            const items = contractorDocs.filter((d) => d.category === category);
            if (items.length === 0) return null;
            return (
              <section key={category} aria-label={documentCategoryHeading[category]}>
                <h3 className="mb-3 text-sm font-semibold text-muted">
                  {documentCategoryHeading[category]}
                  <span className="ml-2 font-normal">{items.length}</span>
                </h3>
                <div className="space-y-3">
                  {items.map((d) => (
                    <DocumentCard
                      key={d.id}
                      document={d}
                      projectId={id}
                      timeZone={project.timeZone}
                      isTeam={isTeam}
                      isOwner={isOwner}
                      canEdit={isOwner || (isTeam && d.createdBy === viewer?.userId)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          {viewerIsClient && clientGroup}
        </div>
      )}
    </div>
  );
}
