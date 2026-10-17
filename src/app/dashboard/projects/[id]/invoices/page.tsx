import { notFound, redirect } from "next/navigation";
import { InvoiceList } from "@/components/invoice-list";
import { MoneyHeader } from "@/components/money-header";
import { todayIn } from "@/lib/format";
import { fetchInvoices, invoiceSummary } from "@/lib/invoices";
import { fetchPaymentTotals, viewerSide } from "@/lib/payments";
import { canMakeInvoices } from "@/lib/plans";
import { getProjectAccess, getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Invoices" };

// The Invoices tab of a project's Payments section. The owner (and staff allowed to invoice on this project) see every
// invoice, drafts too; the homeowner sees the ones sent to them. Other staff go back to Payments.
export default async function InvoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const viewer = await getViewer();
  const isTeam = !!viewer?.company && viewer.company.id === project.company_id;
  const isOwner = isTeam && viewer?.company?.role === "owner";
  const access = await getProjectAccess(id);
  if (isTeam && !access.invoices) redirect(`/dashboard/projects/${id}/payments`);

  const supabase = await createClient();
  const [invoices, totals] = await Promise.all([fetchInvoices(supabase, id), fetchPaymentTotals(supabase, id)]);

  return (
    <div>
      <MoneyHeader
        projectId={id}
        active="invoices"
        currency={project.currency}
        side={viewerSide(isTeam, isOwner)}
        totals={totals}
        invoiced={invoiceSummary(invoices)}
      />
      <InvoiceList
        projectId={id}
        invoices={invoices}
        canManage={isTeam}
        canCreate={isTeam && canMakeInvoices(project.plan)}
        today={todayIn(project.timeZone)}
      />
    </div>
  );
}
