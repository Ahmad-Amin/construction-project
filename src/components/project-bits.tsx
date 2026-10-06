import { projectStatusLabel } from "@/lib/project";
import type { ProjectStatus } from "@/lib/types";

const statusStyles: Record<ProjectStatus, string> = {
  active: "bg-success-soft text-success",
  on_hold: "bg-primary-soft text-primary-hover",
  completed: "bg-surface-2 text-muted",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
      {projectStatusLabel[status]}
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
