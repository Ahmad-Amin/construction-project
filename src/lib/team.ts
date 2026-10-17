import type { SupabaseClient } from "@supabase/supabase-js";

// The owner's view of the team: the staff who have joined, the invitations still open, and which projects each can open.
export type TeamProject = { id: string; name: string; archived: boolean };
export type ProjectAccess = { id: string; pay: boolean };

export type TeamMember = { userId: string; name: string; email: string; since: string; projects: ProjectAccess[] };
export type TeamInvite = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "expired";
  since: string;
  expiresAt: string;
  projects: ProjectAccess[];
};
export type Team = { members: TeamMember[]; invites: TeamInvite[]; projects: TeamProject[] };

type TeamRow = {
  kind: "member" | "invite";
  member_user_id: string | null;
  invite_id: string | null;
  name: string;
  email: string;
  status: string;
  since: string;
  expires_at: string | null;
};

// Everything here runs as the owner: the database refuses anyone else.
export async function fetchTeam(supabase: SupabaseClient): Promise<Team> {
  const [teamRes, accessRes, inviteAccessRes, projectsRes] = await Promise.all([
    supabase.rpc("company_team"),
    supabase.from("project_staff").select("project_id, user_id, can_see_payments"),
    supabase.from("staff_invite_projects").select("invite_id, project_id, can_see_payments"),
    supabase.from("projects").select("id, name, archived_at").order("created_at", { ascending: false }).limit(200),
  ]);

  const rows = (teamRes.data ?? []) as TeamRow[];
  const byUser = new Map<string, ProjectAccess[]>();
  for (const a of (accessRes.data ?? []) as { project_id: string; user_id: string; can_see_payments: boolean }[]) {
    byUser.set(a.user_id, [...(byUser.get(a.user_id) ?? []), { id: a.project_id, pay: a.can_see_payments }]);
  }
  const byInvite = new Map<string, ProjectAccess[]>();
  for (const a of (inviteAccessRes.data ?? []) as { invite_id: string; project_id: string; can_see_payments: boolean }[]) {
    byInvite.set(a.invite_id, [...(byInvite.get(a.invite_id) ?? []), { id: a.project_id, pay: a.can_see_payments }]);
  }

  return {
    members: rows
      .filter((r) => r.kind === "member" && r.member_user_id)
      .map((r) => ({
        userId: r.member_user_id!,
        name: r.name,
        email: r.email,
        since: r.since,
        projects: byUser.get(r.member_user_id!) ?? [],
      })),
    invites: rows
      .filter((r) => r.kind === "invite" && r.invite_id)
      .map((r) => ({
        id: r.invite_id!,
        name: r.name,
        email: r.email,
        status: r.status === "expired" ? ("expired" as const) : ("pending" as const),
        since: r.since,
        expiresAt: r.expires_at ?? r.since,
        projects: byInvite.get(r.invite_id!) ?? [],
      })),
    projects: ((projectsRes.data ?? []) as { id: string; name: string; archived_at: string | null }[]).map((p) => ({
      id: p.id,
      name: p.name,
      archived: !!p.archived_at,
    })),
  };
}

// How many of the plan's staff places are taken: staff who joined, plus invitations still waiting.
export const staffPlacesUsed = (team: Team) => team.members.length + team.invites.filter((i) => i.status === "pending").length;
