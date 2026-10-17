import { notFound, redirect } from "next/navigation";
import { InvoiceForm } from "@/components/invoice-form";
import { InvoiceUpgrade } from "@/components/invoice-upgrade";
import { todayIn } from "@/lib/format";
import { fetchSchedule } from "@/lib/payment-schedule";
import { canMakeInvoices } from "@/lib/plans";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "New invoice" };

// yyyy-mm-dd plus a number of days, without any time zone getting involved.
const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export default async function NewInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  // Only the company owner creates invoices (the database checks this too).
  const viewer = await getViewer();
  if (viewer?.company?.id !== project.company_id || viewer.company.role !== "owner") redirect(`/dashboard/projects/${id}/payments`);
  if (!canMakeInvoices(project.plan)) return <InvoiceUpgrade />;

  const supabase = await createClient();
  const [schedule, companyRes] = await Promise.all([
    fetchSchedule(supabase, id),
    supabase.from("companies").select("payment_instructions").eq("id", project.company_id).maybeSingle(),
  ]);
  const today = todayIn(project.timeZone);

  return (
    <div className="max-w-3xl">
      <h2 className="mb-4 text-xl font-bold tracking-tight">New invoice</h2>
      <InvoiceForm
        projectId={id}
        invoiceId={crypto.randomUUID()}
        initial={{ issueDate: today, dueDate: addDays(today, 14), lines: [], taxLabel: "", taxRate: null, note: "", scheduleItemId: null }}
        currency={project.currency}
        today={today}
        schedule={schedule.map((s) => ({ id: s.id, title: s.title, amount: s.amount, left: s.left }))}
        paymentInstructions={(companyRes.data?.payment_instructions as string | undefined) ?? ""}
        editing={false}
      />
    </div>
  );
}
