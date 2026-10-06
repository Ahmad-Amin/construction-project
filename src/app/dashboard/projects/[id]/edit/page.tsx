import { notFound, redirect } from "next/navigation";
import { ProjectDangerZone } from "@/components/project-danger-zone";
import { ProjectForm } from "@/components/project-form";
import { createClient } from "@/lib/supabase/server";
import { one, type ClientInfo } from "@/lib/types";
import { getViewer } from "@/lib/viewer";
import { updateProject } from "../../actions";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer?.company?.role !== "owner") redirect(`/dashboard/projects/${id}`);

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, location, start_date, expected_completion_date, status, archived_at, client:clients(id, name, email, phone, user_id), budget:project_budgets(amount, visible_to_client)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  // What deleting would remove, shown to the owner before they confirm.
  const head = { count: "exact", head: true } as const;
  const [milestones, updates, photos, expenses, receipts, payments, blocker] = await Promise.all([
    supabase.from("milestones").select("id", head).eq("project_id", id),
    supabase.from("project_updates").select("id", head).eq("project_id", id),
    supabase.from("project_photos").select("id", head).eq("project_id", id),
    supabase.from("expenses").select("id", head).eq("project_id", id),
    supabase.from("expenses").select("id", head).eq("project_id", id).not("receipt_path", "is", null),
    supabase.from("payments").select("id", head).eq("project_id", id),
    supabase.rpc("delete_project_blocker", { p_project_id: id }),
  ]);

  const client = one(project.client as ClientInfo | ClientInfo[] | null);
  const budget = one(
    project.budget as { amount: number; visible_to_client: boolean } | { amount: number; visible_to_client: boolean }[] | null,
  );

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold tracking-tight">Edit project</h2>
      <ProjectForm
        action={updateProject.bind(null, id)}
        mode="edit"
        emailLocked={!!client?.user_id}
        cancelHref={`/dashboard/projects/${id}`}
        defaults={{
          name: project.name,
          location: project.location,
          start_date: project.start_date ?? "",
          expected_completion_date: project.expected_completion_date ?? "",
          status: project.status,
          budget: budget ? String(budget.amount) : "",
          budget_visible: budget?.visible_to_client ?? false,
          client_name: client?.name ?? "",
          client_email: client?.email ?? "",
          client_phone: client?.phone ?? "",
        }}
      />
      <ProjectDangerZone
        projectId={id}
        projectName={project.name}
        archived={!!project.archived_at}
        blocker={(blocker.data as string | null) ?? null}
        counts={{
          milestones: milestones.count ?? 0,
          updates: updates.count ?? 0,
          photos: photos.count ?? 0,
          expenses: expenses.count ?? 0,
          receipts: receipts.count ?? 0,
          payments: payments.count ?? 0,
        }}
      />
    </div>
  );
}
