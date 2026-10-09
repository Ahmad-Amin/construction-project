import { notFound, redirect } from "next/navigation";
import { PaymentForm } from "@/components/payment-form";
import { todayInKarachi } from "@/lib/format";
import { fetchSchedule } from "@/lib/payment-schedule";
import { viewerSide } from "@/lib/payments";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/format";
import { getViewer } from "@/lib/viewer";
import { createPayment } from "../actions";

export const metadata = { title: "Record payment" };

export default async function NewPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ for?: string }>;
}) {
  const { id } = await params;
  const { for: forItem } = await searchParams;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  // The owner and the homeowner can record payments. Site staff can only look.
  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";
  const side = viewerSide(isTeam, isOwner);
  if (!viewer || !side) redirect(`/dashboard/projects/${id}/payments`);

  const today = todayInKarachi();

  // Instalments still waiting for money. "Record payment" on one of them arrives with it picked
  // and the amount filled in.
  const open = (await fetchSchedule(await createClient(), id)).filter((i) => i.left > 0);
  const chosen = open.find((i) => i.id === forItem);

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
        scheduleOptions={open.map((i) => ({ id: i.id, label: `${i.title} · ${formatPKR(i.left)} to go` }))}
        initial={{
          amount: chosen ? String(chosen.left) : "",
          payment_date: today,
          reference: "",
          note: "",
          schedule_item_id: chosen?.id ?? "",
        }}
      />
    </div>
  );
}
