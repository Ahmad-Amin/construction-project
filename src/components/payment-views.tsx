import { notFound, redirect } from "next/navigation";
import { FormFrame, FormHeading } from "@/components/form-frame";
import { PaymentForm } from "@/components/payment-form";
import { ScheduleForm } from "@/components/schedule-form";
import { formatPKR, todayInKarachi } from "@/lib/format";
import { fetchSchedule, fetchStages } from "@/lib/payment-schedule";
import { PAYMENT_COLUMNS, toPaymentItem, viewerSide, withReceiptUrls } from "@/lib/payments";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import {
  createPayment,
  createScheduleItem,
  updatePayment,
  updateScheduleItem,
} from "@/app/dashboard/projects/[id]/payments/actions";

// The four payment forms. Each one is used twice: as a full page (a direct visit, a refresh, a
// phone-sized link) and inside the slide-over panel that opens over the Payments page. `sheet`
// only changes the wrapper: a full page keeps the form to a readable column, the panel fills
// its own width.
type ViewProps = { projectId: string; sheet?: boolean };

export async function NewPaymentView({ projectId: id, forItem, sheet }: ViewProps & { forItem?: string }) {
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
    <FormFrame sheet={sheet}>
      <FormHeading>{side === "client" ? "Record a payment you made" : "Record payment received"}</FormHeading>
      <PaymentForm
        sheet={sheet}
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
    </FormFrame>
  );
}

export async function EditPaymentView({ projectId: id, paymentId, sheet }: ViewProps & { paymentId: string }) {
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";
  const side = viewerSide(isTeam, isOwner);
  if (!viewer || !side) redirect(`/dashboard/projects/${id}/payments`);

  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("id", paymentId)
    .eq("project_id", id)
    .maybeSingle();
  if (!data) notFound();
  const [payment] = await withReceiptUrls(supabase, [toPaymentItem(data)]);

  // Only whoever recorded it can change it, and not once the other side has confirmed.
  if (payment.createdBy !== viewer.userId || payment.status === "confirmed") {
    redirect(`/dashboard/projects/${id}/payments`);
  }

  // The instalments this payment could settle: ones with money still to come, and the one it is on now.
  const options = (await fetchSchedule(supabase, id)).filter((i) => i.left > 0 || i.id === payment.scheduleItemId);

  return (
    <FormFrame sheet={sheet}>
      <FormHeading>Edit payment</FormHeading>
      {payment.status === "disputed" && (
        <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          This payment was disputed. Saving your changes sends it back for confirmation.
        </p>
      )}
      <PaymentForm
        sheet={sheet}
        mode="edit"
        side={side}
        projectId={id}
        today={todayInKarachi()}
        paymentId={paymentId}
        receipt={payment.receiptPath ? { path: payment.receiptPath, url: payment.receiptUrl } : null}
        action={updatePayment.bind(null, id, paymentId)}
        initial={{
          amount: String(payment.amount),
          payment_date: payment.date,
          reference: payment.reference,
          note: payment.note,
          schedule_item_id: payment.scheduleItemId ?? "",
        }}
        scheduleOptions={options.map((i) => ({ id: i.id, label: `${i.title} · ${formatPKR(i.amount)}` }))}
      />
    </FormFrame>
  );
}

export async function NewScheduleView({ projectId: id, sheet }: ViewProps) {
  const project = await getProjectBasic(id);
  if (!project) notFound();

  // Only the company owner plans the payments.
  const viewer = await getViewer();
  const isOwner = !!viewer?.company && viewer.company.id === project.company_id && viewer.company.role === "owner";
  if (!isOwner) redirect(`/dashboard/projects/${id}/payments`);

  const stages = await fetchStages(await createClient(), id);

  return (
    <FormFrame sheet={sheet}>
      <FormHeading>Add an instalment</FormHeading>
      <ScheduleForm
        sheet={sheet}
        mode="create"
        projectId={id}
        stages={stages}
        action={createScheduleItem.bind(null, id)}
        initial={{ title: "", amount: "", milestone_id: "" }}
      />
    </FormFrame>
  );
}

export async function EditScheduleView({ projectId: id, itemId, sheet }: ViewProps & { itemId: string }) {
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
    <FormFrame sheet={sheet}>
      <FormHeading>Edit instalment</FormHeading>
      <ScheduleForm
        sheet={sheet}
        mode="edit"
        projectId={id}
        stages={stages}
        action={updateScheduleItem.bind(null, id, itemId)}
        initial={{ title: item.title, amount: String(item.amount), milestone_id: item.milestone_id ?? "" }}
      />
    </FormFrame>
  );
}
