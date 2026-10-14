import Link from "next/link";
import { Download, ExternalLink, FileSpreadsheet, FileText, Image as ImageIcon, Pencil, type LucideIcon } from "lucide-react";
import { ClientShareToggle, DeleteDocumentButton, DocumentVisibilityToggle } from "@/components/document-controls";
import { LinkPending } from "@/components/link-pending";
import {
  DOCUMENT_TYPES,
  documentCategoryLabel,
  formatFileSize,
  type DocumentItem,
  type DocumentKind,
} from "@/lib/documents";
import { dayInZone, formatDate } from "@/lib/format";
import { button } from "@/lib/ui";

const kindIcon: Record<DocumentKind, LucideIcon> = {
  pdf: FileText,
  word: FileText,
  image: ImageIcon,
  excel: FileSpreadsheet,
};

const kindLabel: Record<DocumentKind, string> = { pdf: "PDF", word: "Word", image: "Image", excel: "Excel" };

// One document, one row: the round icon says what kind of file it is, the buttons on the right
// open or download it, and whatever the team can do with it (who sees it, edit, delete) is in a
// quiet strip along the bottom.
export function DocumentCard({
  document: d,
  projectId,
  timeZone,
  isTeam,
  isOwner,
  canEdit,
  viewerIsClient = false,
}: {
  document: DocumentItem;
  projectId: string;
  timeZone: string;
  isTeam: boolean;
  isOwner: boolean;
  canEdit: boolean;
  // The homeowner is looking at this page.
  viewerIsClient?: boolean;
}) {
  const kind = DOCUMENT_TYPES[d.mime].kind;
  const Icon = kindIcon[kind];
  const file = `/dashboard/projects/${projectId}/documents/${d.id}/file`;
  // Browsers can show a PDF or an image in a tab; Word and Excel files can only be downloaded.
  const canOpen = kind === "pdf" || kind === "image";

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap sm:gap-4 sm:px-5 sm:py-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary sm:size-10">
          <Icon className="size-4 sm:size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="break-words font-semibold">{d.title}</p>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium">
              {documentCategoryLabel[d.category]}
            </span>
          </div>
          <p className="mt-0.5 break-words text-sm text-muted">
            {kindLabel[kind]} · {formatFileSize(d.fileSize)}
            <span aria-hidden> · </span>
            {formatDate(dayInZone(d.createdAt, timeZone))}
            {d.createdByName && (
              <>
                <span aria-hidden> · </span>
                {d.fromClient && viewerIsClient ? "Added by you" : `Added by ${d.createdByName}`}
              </>
            )}
          </p>
        </div>

        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          {canOpen && (
            <a href={file} target="_blank" rel="noopener noreferrer" className={`${button("secondary", "sm")} flex-1 sm:flex-none`}>
              <ExternalLink className="size-4" aria-hidden /> Open
            </a>
          )}
          <a href={`${file}?download=1`} className={`${button(canOpen ? "secondary" : "primary", "sm")} flex-1 sm:flex-none`}>
            <Download className="size-4" aria-hidden /> Download
          </a>
        </div>
      </div>

      {/* The contractor's own document, seen by the team: who it is shared with, edit, delete. */}
      {isTeam && !d.fromClient && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/40 px-4 py-2.5 sm:px-5">
          <DocumentVisibilityToggle projectId={projectId} documentId={d.id} visible={d.clientVisible} interactive={isOwner} />
          <span className="ml-auto flex items-center gap-1">
            {canEdit && (
              <Link
                href={`/dashboard/projects/${projectId}/documents/${d.id}/edit`}
                aria-label="Edit document"
                title="Edit document"
                className="relative flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <Pencil className="size-4" aria-hidden />
                <LinkPending className="absolute size-4 rounded-full bg-surface" />
              </Link>
            )}
            {canEdit && <DeleteDocumentButton projectId={projectId} documentId={d.id} label={d.title} />}
          </span>
        </div>
      )}

      {/* The homeowner's own document: they choose whether the contractor sees it. */}
      {viewerIsClient && d.fromClient && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/40 px-4 py-2.5 sm:px-5">
          <ClientShareToggle projectId={projectId} documentId={d.id} shared={d.teamVisible} />
          <span className="ml-auto flex items-center gap-1">
            <Link
              href={`/dashboard/projects/${projectId}/documents/${d.id}/edit`}
              aria-label="Edit document"
              title="Edit document"
              className="relative flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <Pencil className="size-4" aria-hidden />
              <LinkPending className="absolute size-4 rounded-full bg-surface" />
            </Link>
            <DeleteDocumentButton projectId={projectId} documentId={d.id} label={d.title} />
          </span>
        </div>
      )}
    </article>
  );
}
