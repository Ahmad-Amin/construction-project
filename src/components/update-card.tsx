import { Flag, User } from "lucide-react";
import { DeleteUpdateButton } from "@/components/delete-update-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { formatDate, formatRelativeDate } from "@/lib/format";
import type { UpdateItem } from "@/lib/updates";

export function UpdateCard({
  update,
  projectId,
  canDelete,
  shareHref,
}: {
  update: UpdateItem;
  projectId: string;
  canDelete: boolean;
  // WhatsApp link to send this update to the client (team only).
  shareHref?: string | null;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5">
      <header className="flex items-start justify-between gap-3 text-sm">
        <div>
          <p className="font-semibold">
            {formatRelativeDate(update.date)}
            {formatRelativeDate(update.date) !== formatDate(update.date) && (
              <span className="ml-2 font-normal text-muted">{formatDate(update.date)}</span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted">
            {update.authorName && (
              <span className="flex items-center gap-1">
                <User className="size-3.5" aria-hidden /> {update.authorName}
              </span>
            )}
            {update.milestone && (
              <span className="flex items-center gap-1">
                <Flag className="size-3.5" aria-hidden /> {update.milestone}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {shareHref && <WhatsAppButton href={shareHref} variant="ghost">Share</WhatsAppButton>}
          {canDelete && <DeleteUpdateButton projectId={projectId} updateId={update.id} />}
        </div>
      </header>

      <p className="mt-3 whitespace-pre-line leading-relaxed">{update.text}</p>
      <PhotoGallery photos={update.photos} />
    </article>
  );
}
