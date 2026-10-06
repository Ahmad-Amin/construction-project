import Link from "next/link";
import { CalendarDays, Download, FolderKanban, Flag, Receipt, Banknote } from "lucide-react";

const files = [
  { kind: "projects", label: "Projects", note: "Each project with its client, budget and overall progress", icon: FolderKanban },
  { kind: "milestones", label: "Milestones", note: "Every stage and its progress", icon: Flag },
  { kind: "updates", label: "Site updates", note: "Dated notes with who posted them", icon: CalendarDays },
  { kind: "expenses", label: "Expenses", note: "Including the ones hidden from your client", icon: Receipt },
  { kind: "payments", label: "Payments", note: "With who recorded them, and who confirmed or disputed", icon: Banknote },
] as const;

// Owner-only downloads. Plain <a> links so the browser saves the file instead of the app navigating.
export function DataExport() {
  return (
    <div>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {files.map(({ kind, label, note, icon: Icon }) => (
          <li key={kind}>
            <a
              href={`/dashboard/export/${kind}`}
              download
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-data-accent">
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block truncate text-xs text-muted">{note}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted group-hover:text-foreground">
                <Download className="size-4" aria-hidden /> CSV
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        These open in Excel or Google Sheets. Photos and receipts stay in the app; to get a full copy of
        those, ask us.{" "}
        <Link href="/trust" className="font-medium underline underline-offset-4">
          How we protect your data
        </Link>
      </p>
    </div>
  );
}
