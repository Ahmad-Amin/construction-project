import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InvoiceActions } from "@/components/invoice-actions";
import { InvoicePaper } from "@/components/invoice-paper";
import { dayInZone, formatDate, formatMoney } from "@/lib/format";
import { fetchInvoiceView, invoiceNumber } from "@/lib/invoices";
import { getOrigin } from "@/lib/origin";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/types";
import { getViewer } from "@/lib/viewer";
import { whatsappHref } from "@/lib/whatsapp";

export const metadata = { title: "Invoice" };

// One invoice. The owner sees drafts and everything sent; the homeowner sees what was sent to them. Row-level security
// makes anything else "not found".
export default async function InvoicePage({ params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id, invoiceId } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const supabase = await createClient();
  const invoice = await fetchInvoiceView(supabase, id, invoiceId);
  if (!invoice) notFound();

  const viewer = await getViewer();
  const isOwner = viewer?.company?.id === project.company_id && viewer.company.role === "owner";

  let share: string | null = null;
  let clientJoined = true;
  if (isOwner) {
    const { data } = await supabase.from("projects").select("client:clients(phone, user_id)").eq("id", id).maybeSingle();
    const client = one(data?.client as { phone: string | null; user_id: string | null } | { phone: string | null; user_id: string | null }[] | null);
    clientJoined = !!client?.user_id;
    if (invoice.status === "sent") {
      const first = invoice.client.name.trim().split(/\s+/)[0];
      share = whatsappHref(
        client?.phone,
        `Assalam o Alaikum${first ? ` ${first}` : ""}, ${invoice.company.name} has sent you invoice ${invoiceNumber(invoice.number)} for ` +
          `${formatMoney(invoice.total, invoice.currency)}${invoice.dueDate ? `, due ${formatDate(invoice.dueDate)}` : ""}. ` +
          `You can view and download it here: ${await getOrigin()}/dashboard/projects/${id}/invoices/${invoiceId}`,
      );
    }
  }

  const banner =
    invoice.status === "draft"
      ? { text: "Draft: only you can see it. Check it, then send it to your client.", tone: "bg-surface-2 text-foreground" }
      : invoice.status === "sent"
        ? { text: `Sent on ${invoice.sentAt ? formatDate(dayInZone(invoice.sentAt, project.timeZone)) : ""}.`, tone: "bg-success-soft text-success" }
        : {
            text: `Cancelled on ${invoice.cancelledAt ? formatDate(dayInZone(invoice.cancelledAt, project.timeZone)) : ""}${invoice.cancelReason ? `: ${invoice.cancelReason}` : "."}`,
            tone: "bg-danger-soft text-danger",
          };

  return (
    <div className="max-w-4xl space-y-5">
      <Link href={`/dashboard/projects/${id}/invoices`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All invoices
      </Link>
      <p className={`rounded-xl px-4 py-3 text-sm font-medium ${banner.tone}`}>{banner.text}</p>
      <InvoiceActions
        projectId={id}
        invoiceId={invoiceId}
        status={invoice.status}
        isOwner={isOwner}
        clientName={invoice.client.name}
        clientJoined={clientJoined}
        whatsappHref={share}
      />
      <InvoicePaper invoice={invoice} />
    </div>
  );
}
