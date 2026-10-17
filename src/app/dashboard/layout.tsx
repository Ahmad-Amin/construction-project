import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { ToastProvider } from "@/components/toast";
import { roleOf } from "@/components/role-tag";
import { countUnread } from "@/lib/notifications";
import { platformAdminEmail } from "@/lib/admin";
import { viewerSide } from "@/lib/payments";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

export const metadata = { robots: { index: false, follow: false } };

// Everything behind login lives under /dashboard. The proxy does a quick
// signed-in check; this is the real one, and it also builds the side navigation.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  // A brand-new contractor has no company yet. The page shows its own full-screen setup, with no sidebar.
  if (!viewer.company && !viewer.isClient) return <>{children}</>;

  const isPlatformAdmin = (await platformAdminEmail()) !== null;
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const isOwner = viewer.company?.role === "owner";
  const side = viewerSide(!!viewer.company, isOwner);

  // Row-level security decides which projects come back: a company sees its own,
  // a homeowner only theirs. Payments waiting on this person show as badges.
  const supabase = await createClient();
  const isStaff = !!viewer.company && viewer.company.role !== "owner";
  const [projectsRes, pendingRes, unread, activeRes, toursRes, staffRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, archived_at")
      .order("created_at", { ascending: false })
      .limit(40),
    side
      ? supabase.from("payments").select("project_id").eq("status", "pending").neq("side", side).limit(1000)
      : Promise.resolve({ data: [] as { project_id: string }[] }),
    countUnread(supabase),
    // How many projects are Active right now (an exact count, not the first 40 in the list above).
    viewer.company
      ? supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active").is("archived_at", null)
      : Promise.resolve({ count: 0 }),
    supabase.from("profiles").select("tours_seen").eq("id", viewer.userId).maybeSingle(),
    // For site staff: which of their projects they may also see payments on (their own rows only).
    isStaff
      ? supabase.from("project_staff").select("project_id, can_see_payments")
      : Promise.resolve({ data: [] as { project_id: string; can_see_payments: boolean }[] }),
  ]);
  const paymentsOn = new Set(
    ((staffRes.data ?? []) as { project_id: string; can_see_payments: boolean }[]).filter((r) => r.can_see_payments).map((r) => r.project_id),
  );
  // The guided tours this person has already been shown. If that can't be read, assume all of them:
  // better to skip a tour than to show it again on every page.
  const toursSeen: string[] = toursRes.error ? ["dashboard", "project"] : ((toursRes.data?.tours_seen as string[] | null) ?? []);

  const awaiting = new Map<string, number>();
  for (const row of (pendingRes.data ?? []) as { project_id: string }[]) {
    awaiting.set(row.project_id, (awaiting.get(row.project_id) ?? 0) + 1);
  }
  const projects = ((projectsRes.data ?? []) as { id: string; name: string; status: ProjectStatus; archived_at: string | null }[]).map(
    (p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      archived: !!p.archived_at,
      awaiting: awaiting.get(p.id) ?? 0,
      // Staff see the Payments section only where the owner allowed it; everyone else always does.
      payments: !isStaff || paymentsOn.has(p.id),
    }),
  );

  return (
    <ToastProvider>
      <ConfirmProvider>
      <AppShell
        user={{
          name: viewer.name,
          email: viewer.email,
          role: roleOf(isOwner, !!viewer.company),
        }}
        company={viewer.company ? { name: viewer.company.name, logoUrl: viewer.company.logoUrl } : null}
        plan={
          viewer.company
            ? { id: viewer.company.plan, activeProjects: activeRes.count ?? 0, lapsed: viewer.company.planLapsed }
            : null
        }
        projects={projects}
        isOwner={isOwner}
        isPlatformAdmin={isPlatformAdmin}
        unread={unread}
        initialCollapsed={collapsed}
        toursSeen={toursSeen}
      >
        {children}
      </AppShell>
      </ConfirmProvider>
    </ToastProvider>
  );
}
