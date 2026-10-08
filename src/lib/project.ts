import type { MilestoneStatus, ProjectStatus } from "@/lib/types";

// Simple average of milestone percentages. No weighting in V1.
export function overallProgress(milestones: { progress_percent: number }[]) {
  if (milestones.length === 0) return 0;
  const total = milestones.reduce((sum, m) => sum + m.progress_percent, 0);
  return Math.round(total / milestones.length);
}

export const milestoneStatusLabel: Record<MilestoneStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

// How each project status looks wherever it is shown: the badge on cards and headers, and the
// dot in the side navigation. Change a colour here and it changes everywhere.
export const projectStatusStyle: Record<ProjectStatus | "archived", { label: string; badge: string; dot: string }> = {
  active: { label: "Active", badge: "bg-success-soft text-success", dot: "bg-success" },
  on_hold: { label: "On hold", badge: "bg-primary-soft text-data-accent", dot: "bg-primary" },
  completed: { label: "Completed", badge: "bg-info-soft text-info", dot: "bg-info" },
  archived: { label: "Archived", badge: "bg-surface-2 text-muted", dot: "bg-muted" },
};

export const projectStatusLabel: Record<ProjectStatus, string> = {
  active: projectStatusStyle.active.label,
  on_hold: projectStatusStyle.on_hold.label,
  completed: projectStatusStyle.completed.label,
};
