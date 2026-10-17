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

export type ProjectAccess = {
  // The company's side of the project (owner or staff), as opposed to the homeowner.
  isTeam: boolean;
  isOwner: boolean;
  // May add and change things on the project: the owner, staff who aren't view-only, and the homeowner (for what is
  // theirs to add). Screens use it to hide buttons; the database refuses the rest anyway.
  canWrite: boolean;
  // Sees the payments (the list, the schedule, the totals).
  payments: boolean;
  // Creates, sends and cancels invoices.
  invoices: boolean;
  // Sees the budget and the client's details (as the database allows).
  budget: boolean;
  clientDetails: boolean;
};

// What this person may do on one project. The owner and the homeowner have the usual rights; site staff have what the
// owner allowed (per project: payments, invoices; per person: view only, budget, client details). The database enforces
// the same rules, so this only decides what the screens show.
export const getProjectAccess = cache(async (projectId: string): Promise<ProjectAccess> => {
  const none = { isTeam: false, isOwner: false, canWrite: false, payments: false, invoices: false, budget: false, clientDetails: false };
  const [viewer, project] = await Promise.all([getViewer(), getProjectBasic(projectId)]);
  if (!viewer || !project) return none;
  const isTeam = viewer.company?.id === project.company_id;
  if (!isTeam) return { ...none, canWrite: true, payments: true, budget: true, clientDetails: true };
  const staff = viewer.company?.staff;
  if (!staff) return { isTeam, isOwner: true, canWrite: true, payments: true, invoices: true, budget: true, clientDetails: true };

  const supabase = await createClient();
  const { data } = await supabase
    .from("project_staff")
    .select("can_see_payments, can_invoice")
    .eq("project_id", projectId)
    .eq("user_id", viewer.userId)
    .maybeSingle();
  const active = !staff.paused;
  const payments = active && data?.can_see_payments === true;
  return {
    isTeam,
    isOwner: false,
    canWrite: active && !staff.viewOnly,
    payments,
    invoices: payments && data?.can_invoice === true && staff.canSeeClient && !staff.viewOnly,
    budget: active && staff.canSeeBudget,
    clientDetails: active && staff.canSeeClient,
  };
});

// Whether this person may see the project's payments. The owner and the project's homeowner always may; site staff only
// when the owner switched it on for them on this project.
export const canSeePayments = async (projectId: string): Promise<boolean> => (await getProjectAccess(projectId)).payments;
