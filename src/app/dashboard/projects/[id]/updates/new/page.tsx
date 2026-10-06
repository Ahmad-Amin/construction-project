import { notFound, redirect } from "next/navigation";
import { UpdateForm } from "@/components/update-form";
import { todayInKarachi } from "@/lib/format";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Add update" };

export default async function NewUpdatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    <div>
      <h2 className="mb-5 text-xl font-bold tracking-tight">Add update</h2>
      <UpdateForm projectId={id} milestones={data ?? []} today={todayInKarachi()} />
    </div>
  );
}
