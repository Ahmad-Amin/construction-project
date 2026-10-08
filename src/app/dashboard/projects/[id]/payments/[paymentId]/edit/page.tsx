import { notFound, redirect } from "next/navigation";
import { PaymentForm } from "@/components/payment-form";
import { todayInKarachi } from "@/lib/format";
import { PAYMENT_COLUMNS, toPaymentItem, viewerSide, withReceiptUrls } from "@/lib/payments";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { updatePayment } from "../../actions";

export const metadata = { title: "Edit payment" };

export default async function EditPaymentPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const { id, paymentId } = await params;
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

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold tracking-tight">Edit payment</h2>
      {payment.status === "disputed" && (
        <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          This payment was disputed. Saving your changes sends it back for confirmation.
        </p>
      )}
      <PaymentForm
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
        }}
      />
    </div>
  );
}
