import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { one, type ProjectStatus } from "@/lib/types";

export type ProjectBasic = {
  id: string;
  company_id: string;
  name: string;
  location: string;
  start_date: string | null;
  expected_completion_date: string | null;
  status: ProjectStatus;
  archived_at: string | null;
  completed_at: string | null;
  company: { name: string; logo_url: string | null } | null;
};

// The project header shared by every project screen. Cached so the layout and
// the page it wraps only ask once. RLS means a project you can't see is just null.
export const getProjectBasic = cache(async (id: string): Promise<ProjectBasic | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, company_id, name, location, start_date, expected_completion_date, status, archived_at, completed_at, company:companies(name, logo_url)")
    .eq("id", id)
    .maybeSingle();
  // A project you can't see (or that doesn't exist) is "not found". A real database problem,
  // like a migration that hasn't been applied, must not look like that: let the error screen show it.
  if (error && error.code !== "22P02") {
    throw new Error(`Could not load the project: ${error.message}`);
  }
  if (!data) return null;
  // The company is a single related row; normalise whatever shape the API returns.
  const row = data as unknown as Omit<ProjectBasic, "company"> & {
    company: ProjectBasic["company"] | NonNullable<ProjectBasic["company"]>[];
  };
  return { ...row, company: one(row.company) };
});
