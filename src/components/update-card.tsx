import { Camera, Flag, StickyNote } from "lucide-react";
import { DeleteUpdateButton } from "@/components/delete-update-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { formatDate, formatRelativeDate } from "@/lib/format";
import type { UpdateItem } from "@/lib/updates";

// One site update, one row: the day and who wrote it on top, the note underneath, and the photos
// in a single row that scrolls sideways.
export function UpdateCard({
  update,
  projectId,
  timeZone,
  canDelete,
  shareHref,
}: {
  timeZone: string;
  update: UpdateItem;
  projectId: string;
  canDelete: boolean;
  // WhatsApp link to send this update to the client (team only).
  shareHref?: string | null;
}) {
  const hasPhotos = update.photos.length > 0;
  const Icon = hasPhotos ? Camera : StickyNote;

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:px-5 sm:py-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted sm:size-10">
          <Icon className="size-4 sm:size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {formatRelativeDate(update.date, timeZone)}
                {formatRelativeDate(update.date, timeZone) !== formatDate(update.date) && (
                  <span className="ml-2 font-normal text-muted">{formatDate(update.date)}</span>
                )}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
                {update.authorName && <span>By {update.authorName}</span>}
                {update.milestone && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-foreground">
                    <Flag className="size-3" aria-hidden /> {update.milestone}
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {shareHref && <WhatsAppButton href={shareHref} variant="ghost">Share</WhatsAppButton>}
              {canDelete && <DeleteUpdateButton projectId={projectId} updateId={update.id} />}
            </div>
          </div>

          <p className="mt-3 max-w-3xl whitespace-pre-line leading-relaxed">{update.text}</p>
          <PhotoGallery photos={update.photos} layout="row" />
        </div>
      </div>
    </article>
  );
}
