// Row shapes for the queries we run. Hand-written until we generate types from the database.
export type ProjectStatus = "active" | "on_hold" | "completed";
export type MilestoneStatus = "not_started" | "in_progress" | "done";

export type Milestone = {
  id: string;
  name: string;
  position: number;
  status: MilestoneStatus;
  progress_percent: number;
};

export type ClientInfo = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  user_id: string | null;
};

// PostgREST returns a single related row as an object, but typing it as
// object-or-array keeps us safe if the relationship shape ever changes.
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
