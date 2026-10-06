import { notFound, redirect } from "next/navigation";
import { PaymentForm } from "@/components/payment-form";
import { todayInKarachi } from "@/lib/format";
import { viewerSide } from "@/lib/payments";
import { getProjectBasic } from "@/lib/projects";
import { getViewer } from "@/lib/viewer";
import { createPayment } from "../actions";

export const metadata = { title: "Record payment" };

export default async function NewPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  // The owner and the homeowner can record payments. Site staff can only look.
  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";
  const side = viewerSide(isTeam, isOwner);
  if (!viewer || !side) redirect(`/dashboard/projects/${id}/payments`);

  const today = todayInKarachi();

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold tracking-tight">
        {side === "client" ? "Record a payment you made" : "Record payment received"}
      </h2>
      <PaymentForm
        mode="create"
        side={side}
        projectId={id}
        draftId={crypto.randomUUID()}
        today={today}
        action={createPayment.bind(null, id)}
        initial={{ amount: "", payment_date: today, reference: "", note: "" }}
      />
    </div>
  );
}
