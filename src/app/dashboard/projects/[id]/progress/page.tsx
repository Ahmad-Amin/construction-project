import { notFound } from "next/navigation";
import { MilestoneEditor, type EditorMode } from "@/components/milestone-editor";
import { ProgressBar } from "@/components/project-bits";
import { overallProgress } from "@/lib/project";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import type { Milestone } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Progress" };

export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const supabase = await createClient();
  const { data } = await supabase
    .from("milestones")
    .select("id, name, position, status, progress_percent")
    .eq("project_id", id)
    .order("position")
    .order("id");
  const milestones = (data ?? []) as Milestone[];
  const percent = overallProgress(milestones);

  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const mode: EditorMode = !isTeam ? "readonly" : viewer?.company?.role === "owner" ? "owner" : "staff";

  return (
    <div>
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Overall progress</h2>
          <span className="text-3xl font-bold">{percent}%</span>
        </div>
        <div className="mt-3">
          <ProgressBar percent={percent} />
        </div>
        <p className="mt-2 text-xs text-muted">The average of all milestones below.</p>
      </section>

      <h2 className="mt-8 mb-3 font-semibold">Milestones</h2>
      <MilestoneEditor projectId={id} milestones={milestones} mode={mode} />
    </div>
  );
}
