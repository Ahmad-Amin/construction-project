import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/types";

type CompanyRow = { id: string; name: string; logo_url: string | null };

export type Viewer = {
  userId: string;
  email: string;
  company: { id: string; name: string; logoUrl: string | null; role: "owner" | "staff" } | null;
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
  const [membership, client] = await Promise.all([
    supabase.from("company_members").select("role, companies(id, name, logo_url)").limit(1),
    supabase.from("clients").select("id").eq("user_id", userId).limit(1),
  ]);

  const row = membership.data?.[0] as
    | { role: "owner" | "staff"; companies: CompanyRow | CompanyRow[] }
    | undefined;
  const company = one(row?.companies);

  return {
    userId,
    email: typeof claims.email === "string" ? claims.email : "",
    company:
      row && company
        ? { id: company.id, name: company.name, logoUrl: company.logo_url, role: row.role }
        : null,
    isClient: (client.data?.length ?? 0) > 0,
  };
});
