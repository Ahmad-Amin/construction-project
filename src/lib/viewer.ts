import { cache } from "react";
import { currencyOrDefault } from "@/lib/currency";
import { effectivePlan, planLapsed, type PlanId } from "@/lib/plans";
import { timeZoneOrDefault } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/types";

type CompanyRow = { id: string; name: string; logo_url: string | null; currency: string; timezone: string; plan: string; plan_until: string | null };

export type Viewer = {
  userId: string;
  name: string;
  email: string;
  company: { id: string; name: string; logoUrl: string | null; currency: string; timeZone: string; plan: PlanId; planUntil: string | null; planLapsed: boolean; role: "owner" | "staff" } | null;
  isClient: boolean;
};

// Who is signed in, and what are they to this app: contractor team or homeowner.
// Cached so the layout and the page share one lookup per request.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const userId = claims.sub;
  const [membership, client, profile] = await Promise.all([
    // Only this person's own membership: everyone in a company may read the company's whole member list, so without the
    // filter a staff member could be handed the owner's row and be treated as the owner.
    supabase.from("company_members").select("role, companies(id, name, logo_url, currency, timezone, plan, plan_until)").eq("user_id", userId).limit(1),
    supabase.from("clients").select("id").eq("user_id", userId).limit(1),
    supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
  ]);

  const row = membership.data?.[0] as
    | { role: "owner" | "staff"; companies: CompanyRow | CompanyRow[] }
    | undefined;
  const company = one(row?.companies);

  return {
    userId,
    name: (profile.data?.name as string | undefined) ?? "",
    email: typeof claims.email === "string" ? claims.email : "",
    company:
      row && company
        ? { id: company.id, name: company.name, logoUrl: company.logo_url, currency: currencyOrDefault(company.currency), timeZone: timeZoneOrDefault(company.timezone), plan: effectivePlan(company.plan, company.plan_until), planUntil: company.plan_until, planLapsed: planLapsed(company.plan, company.plan_until), role: row.role }
        : null,
    isClient: (client.data?.length ?? 0) > 0,
  };
});
