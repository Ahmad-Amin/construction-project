import { notFound, redirect } from "next/navigation";
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
      "id, name, location, start_date, expected_completion_date, status, client:clients(id, name, email, phone, user_id), budget:project_budgets(amount, visible_to_client)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

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
    </div>
  );
}
