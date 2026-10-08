import { projectStatusStyle } from "@/lib/project";
import type { ProjectStatus } from "@/lib/types";

// The one place a project's status is drawn: project header, dashboard cards and anywhere else.
// Pass `archived` to show "Archived" in grey instead of the status.
export function StatusBadge({
  status,
  archived = false,
  className = "",
}: {
  status: ProjectStatus;
  archived?: boolean;
  className?: string;
}) {
  const style = projectStatusStyle[archived ? "archived" : status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

export function ProgressBar({ percent, thin = false }: { percent: number; thin?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`overflow-hidden rounded-full bg-surface-2 ${thin ? "h-1.5" : "h-2.5"}`}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}
