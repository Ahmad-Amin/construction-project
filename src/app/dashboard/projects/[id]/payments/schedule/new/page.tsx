import { notFound, redirect } from "next/navigation";
import { ScheduleForm } from "@/components/schedule-form";
import { fetchStages } from "@/lib/payment-schedule";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { createScheduleItem } from "../../actions";

export const metadata = { title: "Add to payment schedule" };

export default async function NewScheduleItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  // Only the company owner plans the payments.
  const viewer = await getViewer();
  const isOwner = !!viewer?.company && viewer.company.id === project.company_id && viewer.company.role === "owner";
  if (!isOwner) redirect(`/dashboard/projects/${id}/payments`);

  const stages = await fetchStages(await createClient(), id);

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold tracking-tight">Add an instalment</h2>
      <ScheduleForm
        mode="create"
        projectId={id}
        stages={stages}
        action={createScheduleItem.bind(null, id)}
        initial={{ title: "", amount: "", milestone_id: "" }}
      />
    </div>
  );
}
