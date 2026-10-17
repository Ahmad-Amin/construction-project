import { notFound, redirect } from "next/navigation";
import { InvoiceForm } from "@/components/invoice-form";
import { todayIn } from "@/lib/format";
import { fetchInvoiceView } from "@/lib/invoices";
import { fetchSchedule } from "@/lib/payment-schedule";
import { getProjectAccess, getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id, invoiceId } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();
  const access = await getProjectAccess(id);
  if (!access.isTeam || !access.invoices) redirect(`/dashboard/projects/${id}/payments`);

  const supabase = await createClient();
  const [invoice, schedule] = await Promise.all([fetchInvoiceView(supabase, id, invoiceId), fetchSchedule(supabase, id)]);
  if (!invoice) notFound();
  // A sent invoice is locked: cancel it and send a new one instead.
  if (invoice.status !== "draft") redirect(`/dashboard/projects/${id}/invoices/${invoiceId}`);

  return (
    <div className="max-w-3xl">
      <h2 className="mb-4 text-xl font-bold tracking-tight">Edit draft invoice</h2>
      <InvoiceForm
        projectId={id}
        invoiceId={invoiceId}
        initial={{
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          lines: invoice.lines,
          taxLabel: invoice.taxLabel,
          taxRate: invoice.taxRate,
          note: invoice.note,
          scheduleItemId: invoice.scheduleItemId,
        }}
        currency={invoice.currency}
        today={todayIn(project.timeZone)}
        schedule={schedule.map((s) => ({ id: s.id, title: s.title, amount: s.amount, left: s.left }))}
        paymentInstructions={invoice.company.paymentInstructions}
        editing
      />
    </div>
  );
}
