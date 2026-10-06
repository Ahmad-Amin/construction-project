import Link from "next/link";
import { Archive, Download, PartyPopper } from "lucide-react";
import { formatDate } from "@/lib/format";
import { button } from "@/lib/ui";

// Shown on every screen of a completed project. Both sides can get the final statement;
// the owner is also pointed at archiving, to tidy the dashboard.
export function CompletedBanner({
  projectId,
  completedOn,
  isOwner,
  canGetStatement,
}: {
  projectId: string;
  completedOn: string | null;
  isOwner: boolean;
  canGetStatement: boolean;
}) {
  return (
    <div role="status" className="animate-rise mt-5 rounded-2xl border border-success/30 bg-success-soft px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <p className="flex items-center gap-2 text-sm font-medium text-success">
        <PartyPopper className="size-4 shrink-0" aria-hidden />
        {completedOn ? `Project completed on ${formatDate(completedOn)}.` : "This project is complete."}
        {isOwner ? " Well done." : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
        {canGetStatement && (
          <a href={`/dashboard/projects/${projectId}/statement`} download className={button("secondary", "sm")}>
            <Download className="size-4" aria-hidden /> Final statement
          </a>
        )}
        {isOwner && (
          <Link href={`/dashboard/projects/${projectId}/edit`} className={button("ghost", "sm")}>
            <Archive className="size-4" aria-hidden /> Archive it
          </Link>
        )}
      </div>
    </div>
  );
}
