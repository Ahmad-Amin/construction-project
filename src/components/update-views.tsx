import { notFound, redirect } from "next/navigation";
import { FormFrame, FormHeading } from "@/components/form-frame";
import { UpdateForm } from "@/components/update-form";
import { todayIn } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { getProjectAccess, getProjectBasic } from "@/lib/projects";
import { videoUploadsOn } from "@/lib/stream";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

// The "Add update" form, used both as a full page and inside the slide-over panel (`sheet`).
export async function NewUpdateView({ projectId: id, sheet }: { projectId: string; sheet?: boolean }) {
  const project = await getProjectBasic(id);
  if (!project) notFound();

  // Homeowners and view-only staff are read-only; the rest of the company's team can post.
  const viewer = await getViewer();
  if (!viewer?.company || viewer.company.id !== project.company_id || !(await getProjectAccess(id)).canWrite) {
    redirect(`/dashboard/projects/${id}/updates`);
  }

  const supabase = await createClient();
  const [{ data }, allowance] = await Promise.all([
    supabase.from("milestones").select("id, name, progress_percent").eq("project_id", id).order("position").order("id"),
    videoUploadsOn() ? supabase.rpc("video_allowance", { p_project: id }) : Promise.resolve(null),
  ]);

  // Site videos: hidden when switched off (or the database can't say); a plan without them shows where to get them.
  let video = null;
  const row = (allowance?.data as { max_seconds: number; monthly_seconds: number; used_seconds: number }[] | null)?.[0];
  if (row) {
    video =
      row.max_seconds > 0
        ? {
            limits: { maxSeconds: row.max_seconds, leftSeconds: Math.max(0, row.monthly_seconds - row.used_seconds), planName: PLANS[project.plan].name },
            upgradeHref: null,
          }
        : { limits: null, upgradeHref: viewer.company.role === "owner" ? "/dashboard/settings#plan" : null };
  }

  return (
    <FormFrame sheet={sheet}>
      <FormHeading>Add update</FormHeading>
      <UpdateForm sheet={sheet} projectId={id} projectName={project.name} milestones={data ?? []} today={todayIn(project.timeZone)} video={video} />
    </FormFrame>
  );
}
