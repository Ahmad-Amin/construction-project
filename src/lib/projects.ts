import { cache } from "react";
import { currencyOrDefault } from "@/lib/currency";
import { effectivePlan, type PlanId } from "@/lib/plans";
import { timeZoneOrDefault } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import { one, type ProjectStatus } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

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
  company: { name: string; logo_url: string | null; currency: string; timezone: string; plan: string; plan_until: string | null } | null;
  // The company's currency code, ready to use when showing any amount on this project.
  currency: string;
  // The company's time zone: what "today" is and which day an event belongs to on this project.
  timeZone: string;
  // The plan of the company that runs this project (what it includes: statements, WhatsApp updates).
  plan: PlanId;
};

// The project header shared by every project screen. Cached so the layout and
// the page it wraps only ask once. RLS means a project you can't see is just null.
export const getProjectBasic = cache(async (id: string): Promise<ProjectBasic | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, company_id, name, location, start_date, expected_completion_date, status, archived_at, completed_at, company:companies(name, logo_url, currency, timezone, plan, plan_until)")
    .eq("id", id)
    .maybeSingle();
  // A project you can't see (or that doesn't exist) is "not found". A real database problem,
  // like a migration that hasn't been applied, must not look like that: let the error screen show it.
  if (error && error.code !== "22P02") {
    throw new Error(`Could not load the project: ${error.message}`);
  }
  if (!data) return null;
  // The company is a single related row; normalise whatever shape the API returns.
  const row = data as unknown as Omit<ProjectBasic, "company" | "currency" | "timeZone" | "plan"> & {
    company: ProjectBasic["company"] | NonNullable<ProjectBasic["company"]>[];
  };
  const company = one(row.company);
  return { ...row, company, currency: currencyOrDefault(company?.currency), timeZone: timeZoneOrDefault(company?.timezone), plan: effectivePlan(company?.plan, company?.plan_until) };
});

// Whether this person may see the project's payments. The owner and the project's homeowner always may; site staff only
// when the owner switched it on for them on this project (the database enforces the same rule).
export const canSeePayments = cache(async (projectId: string): Promise<boolean> => {
  const viewer = await getViewer();
  if (!viewer) return false;
  if (!viewer.company || viewer.company.role === "owner") return true;
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_staff")
    .select("can_see_payments")
    .eq("project_id", projectId)
    .eq("user_id", viewer.userId)
    .maybeSingle();
  return data?.can_see_payments === true;
});
