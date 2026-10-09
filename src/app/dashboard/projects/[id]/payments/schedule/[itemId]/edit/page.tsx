import { notFound, redirect } from "next/navigation";
import { ScheduleForm } from "@/components/schedule-form";
import { fetchSchedule, fetchStages } from "@/lib/payment-schedule";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { updateScheduleItem } from "../../../actions";

export const metadata = { title: "Edit instalment" };

export default async function EditScheduleItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const isOwner = !!viewer?.company && viewer.company.id === project.company_id && viewer.company.role === "owner";
  if (!isOwner) redirect(`/dashboard/projects/${id}/payments`);

  const supabase = await createClient();
  const [{ data: item }, stages, schedule] = await Promise.all([
    supabase
      .from("scheduled_payments")
      .select("id, title, amount, milestone_id")
      .eq("id", itemId)
      .eq("project_id", id)
      .maybeSingle(),
    fetchStages(supabase, id),
    fetchSchedule(supabase, id),
  ]);
  if (!item) notFound();
  // Once confirmed payments cover an instalment it is a settled record.
  if (schedule.find((i) => i.id === itemId)?.status === "paid") redirect(`/dashboard/projects/${id}/payments`);

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold tracking-tight">Edit instalment</h2>
      <ScheduleForm
        mode="edit"
        projectId={id}
        stages={stages}
        action={updateScheduleItem.bind(null, id, itemId)}
        initial={{ title: item.title, amount: String(item.amount), milestone_id: item.milestone_id ?? "" }}
      />
    </div>
  );
}
