import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { InvoiceDocument } from "@/lib/invoice-pdf";
import { fetchInvoiceView, invoiceNumber } from "@/lib/invoices";
import { download } from "@/lib/statement";
import { createClient } from "@/lib/supabase/server";

// The invoice as a PDF. Row-level security decides who gets it: the owner (drafts too, marked DRAFT) and the homeowner
// it was sent to. Everyone else gets "not found".
export async function GET(request: Request, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id, invoiceId } = await params;
  const supabase = await createClient();
  const invoice = await fetchInvoiceView(supabase, id, invoiceId);
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const logo = invoice.company.logoUrl ? await download(invoice.company.logoUrl) : null;
  const pdf = await renderToBuffer(<InvoiceDocument invoice={invoice} logo={logo} />);

  const slug = invoice.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  const name = `${invoiceNumber(invoice.number).toLowerCase()}-${slug}.pdf`;
  const asDownload = new URL(request.url).searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
