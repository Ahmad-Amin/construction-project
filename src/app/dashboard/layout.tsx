import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { viewerSide } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

// Everything behind login lives under /dashboard. The proxy does a quick
// signed-in check; this is the real one, and it also builds the side navigation.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const isOwner = viewer.company?.role === "owner";
  const side = viewerSide(!!viewer.company, isOwner);

  // Row-level security decides which projects come back: a company sees its own,
  // a homeowner only theirs. Payments waiting on this person show as badges.
  const supabase = await createClient();
  const [projectsRes, pendingRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status")
      .order("created_at", { ascending: false })
      .limit(40),
    side
      ? supabase.from("payments").select("project_id").eq("status", "pending").neq("side", side).limit(1000)
      : Promise.resolve({ data: [] as { project_id: string }[] }),
  ]);

  const awaiting = new Map<string, number>();
  for (const row of (pendingRes.data ?? []) as { project_id: string }[]) {
    awaiting.set(row.project_id, (awaiting.get(row.project_id) ?? 0) + 1);
  }
  const projects = ((projectsRes.data ?? []) as { id: string; name: string; status: ProjectStatus }[]).map((p) => ({
    ...p,
    awaiting: awaiting.get(p.id) ?? 0,
  }));

  return (
    <AppShell
      user={{
        name: viewer.name,
        email: viewer.email,
        roleLabel: isOwner ? "Owner" : viewer.company ? "Site team" : "Homeowner",
      }}
      company={viewer.company ? { name: viewer.company.name, logoUrl: viewer.company.logoUrl } : null}
      projects={projects}
      isOwner={isOwner}
    >
      {children}
    </AppShell>
  );
}
