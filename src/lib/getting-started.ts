import type { SupabaseClient } from "@supabase/supabase-js";

export type GettingStartedStep = {
  id: "project" | "invite" | "update" | "expense" | "payment" | "logo";
  title: string;
  description: string;
  done: boolean;
  optional: boolean;
  // Where the button goes, or null while an earlier step is still needed.
  href: string | null;
  cta: string;
  // Shown instead of the button while the step is locked.
  locked?: string;
};

export type GettingStarted = {
  steps: GettingStartedStep[];
  done: number;
  total: number;
  complete: boolean;
  nextId: GettingStartedStep["id"] | null;
};

// A checklist built from what the owner has actually done, so it can never be out of date.
// Returns null once they've hidden it.
export async function fetchGettingStarted(
  supabase: SupabaseClient,
  userId: string,
  hasLogo: boolean,
): Promise<GettingStarted | null> {
  const head = { count: "exact", head: true } as const;
  const [profile, projectsRes, updates, expenses, payments] = await Promise.all([
    supabase.from("profiles").select("getting_started_dismissed_at").eq("id", userId).maybeSingle(),
    supabase
      .from("projects")
      .select("id, client:clients(user_id)")
      .order("created_at", { ascending: true })
      .limit(50),
    supabase.from("project_updates").select("id", head),
    supabase.from("expenses").select("id", head),
    supabase.from("payments").select("id", head),
  ]);

  // If the column isn't there yet (migration not applied) the checklist just shows.
  if (profile.data?.getting_started_dismissed_at) return null;

  const projects = (projectsRes.data ?? []) as { id: string; client: { user_id: string | null } | { user_id: string | null }[] | null }[];
  const first = projects[0]?.id ?? null;
  const base = first ? `/dashboard/projects/${first}` : null;
  const clientJoined = projects.some((p) => {
    const c = Array.isArray(p.client) ? p.client[0] : p.client;
    return !!c?.user_id;
  });
  const needProject = "Create your first project first.";

  const steps: GettingStartedStep[] = [
    {
      id: "project",
      title: "Create your first project",
      description: "Add the project and your client, and pick a template so the stages are ready.",
      done: projects.length > 0,
      optional: false,
      href: "/dashboard/projects/new",
      cta: "Create project",
    },
    {
      id: "invite",
      title: "Invite your client",
      description: "Share the private link on WhatsApp. They set a password and see only their project.",
      done: clientJoined,
      optional: false,
      href: base,
      cta: "Get the invite link",
      locked: base ? undefined : needProject,
    },
    {
      id: "update",
      title: "Post a site update",
      description: "A short note and a few photos from your phone. Your client sees it straight away.",
      done: (updates.count ?? 0) > 0,
      optional: false,
      href: base ? `${base}/updates/new` : null,
      cta: "Post an update",
      locked: base ? undefined : needProject,
    },
    {
      id: "expense",
      title: "Add an expense with its receipt",
      description: "Choose later what your client sees. New expenses start hidden.",
      done: (expenses.count ?? 0) > 0,
      optional: false,
      href: base ? `${base}/expenses/new` : null,
      cta: "Add an expense",
      locked: base ? undefined : needProject,
    },
    {
      id: "payment",
      title: "Record a payment you received",
      description: "Your client confirms it, so you both have the same record.",
      done: (payments.count ?? 0) > 0,
      optional: false,
      href: base ? `${base}/payments/new` : null,
      cta: "Record a payment",
      locked: base ? undefined : needProject,
    },
    {
      id: "logo",
      title: "Add your company logo",
      description: "Optional. It appears at the top of every page your clients open.",
      done: hasLogo,
      optional: true,
      href: "/dashboard/settings",
      cta: "Add logo",
    },
  ];

  const required = steps.filter((s) => !s.optional);
  const next = steps.find((s) => !s.done && !s.optional && s.href) ?? steps.find((s) => !s.done && s.href);

  return {
    steps,
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    complete: required.every((s) => s.done),
    nextId: next?.id ?? null,
  };
}
