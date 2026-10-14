import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderOpen, Plus } from "lucide-react";
import { DocumentCard } from "@/components/document-card";
import { DocumentFilterBar, type DocumentFilter } from "@/components/document-filter-bar";
import { LinkPending } from "@/components/link-pending";
import { DOCUMENT_CATEGORIES, fetchDocuments } from "@/lib/documents";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { button } from "@/lib/ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";

  const documents = await fetchDocuments(await createClient(), id);
  const viewerIsClient = !isTeam;
  const shared = documents.filter((d) => !d.fromClient && d.clientVisible).length;

  // Which pill is selected (the address carries it, so a filtered view can be bookmarked).
  const { type } = await searchParams;
  const active: DocumentFilter =
    type === "client" || (DOCUMENT_CATEGORIES as readonly string[]).includes(type ?? "") ? (type as DocumentFilter) : "all";
  const counts = Object.fromEntries([
    ["all", documents.length],
    ["client", documents.filter((d) => d.fromClient).length],
    ...DOCUMENT_CATEGORIES.map((c) => [c, documents.filter((d) => d.category === c).length]),
  ]) as Record<DocumentFilter, number>;
  const shown = documents.filter((d) =>
    active === "all" ? true : active === "client" ? d.fromClient : d.category === active,
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
        <Link href={`/dashboard/projects/${id}/documents/new`} data-tour="add" className={button("primary", "sm")}>
          <Plus className="size-4" aria-hidden /> Add document
          <LinkPending className="size-4" />
        </Link>
      </div>

      {documents.length === 0 ? (
        <div data-tour="list" className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
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
        <>
          <DocumentFilterBar
            base={`/dashboard/projects/${id}/documents`}
            active={active}
            counts={counts}
            clientLabel={viewerIsClient ? "Added by you" : "From your client"}
          />
          <div data-tour="list" className="space-y-3">
            {shown.map((d) => (
              <DocumentCard
                key={d.id}
                document={d}
                projectId={id}
                timeZone={project.timeZone}
                isTeam={isTeam}
                isOwner={isOwner}
                canEdit={!d.fromClient && (isOwner || (isTeam && d.createdBy === viewer?.userId))}
                viewerIsClient={viewerIsClient}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
