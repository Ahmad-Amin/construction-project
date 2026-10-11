import { notFound, redirect } from "next/navigation";
import { FormFrame, FormHeading } from "@/components/form-frame";
import { UpdateForm } from "@/components/update-form";
import { todayInKarachi } from "@/lib/format";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

// The "Add update" form, used both as a full page and inside the slide-over panel (`sheet`).
export async function NewUpdateView({ projectId: id, sheet }: { projectId: string; sheet?: boolean }) {
  const project = await getProjectBasic(id);
  if (!project) notFound();

  // Homeowners are read-only; only the company's team can post.
  const viewer = await getViewer();
  if (!viewer?.company || viewer.company.id !== project.company_id) {
    redirect(`/dashboard/projects/${id}/updates`);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("milestones")
    .select("id, name, progress_percent")
    .eq("project_id", id)
    .order("position")
    .order("id");

  return (
    <FormFrame sheet={sheet}>
      <FormHeading>Add update</FormHeading>
      <UpdateForm sheet={sheet} projectId={id} milestones={data ?? []} today={todayInKarachi()} />
    </FormFrame>
  );
}
