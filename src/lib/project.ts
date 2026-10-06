import type { MilestoneStatus, ProjectStatus } from "@/lib/types";

// Simple average of milestone percentages. No weighting in V1.
export function overallProgress(milestones: { progress_percent: number }[]) {
  if (milestones.length === 0) return 0;
  const total = milestones.reduce((sum, m) => sum + m.progress_percent, 0);
  return Math.round(total / milestones.length);
}

export const projectStatusLabel: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

export const milestoneStatusLabel: Record<MilestoneStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};
