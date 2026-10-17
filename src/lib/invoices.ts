import type { SupabaseClient } from "@supabase/supabase-js";
import { currencyOrDefault } from "@/lib/currency";
import { one } from "@/lib/types";

// Invoices the company owner creates and sends to the project's homeowner. The database decides who can do what and
// works out the totals; this file loads them for the screens and the PDF.
export type InvoiceStatus = "draft" | "sent" | "cancelled";
export type InvoiceLine = { description: string; amount: number };

export const invoiceStatusLabel: Record<InvoiceStatus, string> = { draft: "Draft", sent: "Sent", cancelled: "Cancelled" };

// "INV-0003". A draft has no number yet: it gets one when it is sent.
export const invoiceNumber = (n: number | null) => (n === null ? "Draft" : `INV-${String(n).padStart(4, "0")}`);

export const MAX_LINES = 50;

// The same arithmetic as the database (which has the final say): tax is rounded to whole units.
export function invoiceTotals(lines: InvoiceLine[], taxRate: number | null) {
  const subtotal = lines.reduce((sum, l) => sum + (Number.isFinite(l.amount) ? l.amount : 0), 0);
  const tax = taxRate ? Math.round((subtotal * taxRate) / 100) : 0;
  return { subtotal, tax, total: subtotal + tax };
}

export type InvoiceListItem = {
  id: string;
  status: InvoiceStatus;
  number: number | null;
  issueDate: string;
  dueDate: string | null;
  total: number;
  currency: string;
  summary: string;
};

type Row = {
  id: string;
  project_id: string;
  status: InvoiceStatus;
  number: number | null;
  issue_date: string;
  due_date: string | null;
  lines: InvoiceLine[];
  subtotal: number;
  tax_label: string;
  tax_rate: number | string | null;
  tax_amount: number;
  total: number;
  note: string;
  schedule_item_id: string | null;
  currency: string;
  company_name: string;
  company_details: string;
  payment_instructions: string;
  client_name: string;
  client_email: string;
  project_name: string;
  project_location: string;
  sent_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string;
};

const COLUMNS =
  "id, project_id, status, number, issue_date, due_date, lines, subtotal, tax_label, tax_rate, tax_amount, total, note, schedule_item_id, currency, company_name, company_details, payment_instructions, client_name, client_email, project_name, project_location, sent_at, cancelled_at, cancel_reason";

// Row-level security decides what comes back: the owner gets every invoice of the project, the homeowner only the ones
// that were sent (and cancelled ones), staff and everyone else nothing.
export async function fetchInvoices(supabase: SupabaseClient, projectId: string): Promise<InvoiceListItem[]> {
  const { data } = await supabase
    .from("invoices")
    .select("id, status, number, issue_date, due_date, total, currency, lines")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Pick<Row, "id" | "status" | "number" | "issue_date" | "due_date" | "total" | "currency" | "lines">[]).map((r) => ({
    id: r.id,
    status: r.status,
    number: r.number,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    total: Number(r.total),
    currency: r.currency,
    summary: r.lines.length === 1 ? r.lines[0].description : `${r.lines[0]?.description ?? ""}${r.lines.length > 1 ? ` and ${r.lines.length - 1} more` : ""}`,
  }));
}

export type InvoiceView = {
  id: string;
  projectId: string;
  status: InvoiceStatus;
  number: number | null;
  issueDate: string;
  dueDate: string | null;
  lines: InvoiceLine[];
  subtotal: number;
  taxLabel: string;
  taxRate: number | null;
  taxAmount: number;
  total: number;
  note: string;
  scheduleItemId: string | null;
  currency: string;
  company: { name: string; details: string; paymentInstructions: string; logoUrl: string | null };
  client: { name: string; email: string };
  project: { name: string; location: string };
  sentAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
};

type Live = {
  name: string;
  location: string | null;
  client: { name: string; email: string } | { name: string; email: string }[] | null;
  company:
    | { name: string; logo_url: string | null; invoice_details: string; payment_instructions: string; currency: string }
    | { name: string; logo_url: string | null; invoice_details: string; payment_instructions: string; currency: string }[]
    | null;
};

// One invoice, ready to show or print. A sent invoice shows exactly what it said when it was sent; a draft shows the
// company's, client's and project's details as they are now (they are copied onto it when it is sent).
export async function fetchInvoiceView(supabase: SupabaseClient, projectId: string, invoiceId: string): Promise<InvoiceView | null> {
  const [invoiceRes, liveRes] = await Promise.all([
    supabase.from("invoices").select(COLUMNS).eq("id", invoiceId).eq("project_id", projectId).maybeSingle(),
    supabase
      .from("projects")
      .select("name, location, client:clients(name, email), company:companies(name, logo_url, invoice_details, payment_instructions, currency)")
      .eq("id", projectId)
      .maybeSingle(),
  ]);
  const r = invoiceRes.data as Row | null;
  if (!r) return null;
  const live = liveRes.data as Live | null;
  const company = one(live?.company ?? null);
  const client = one(live?.client ?? null);
  const draft = r.status === "draft";

  return {
    id: r.id,
    projectId: r.project_id,
    status: r.status,
    number: r.number,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    lines: r.lines,
    subtotal: Number(r.subtotal),
    taxLabel: r.tax_label,
    taxRate: r.tax_rate === null ? null : Number(r.tax_rate),
    taxAmount: Number(r.tax_amount),
    total: Number(r.total),
    note: r.note,
    scheduleItemId: r.schedule_item_id,
    currency: draft ? currencyOrDefault(company?.currency) : r.currency,
    company: {
      name: draft ? (company?.name ?? "") : r.company_name,
      details: draft ? (company?.invoice_details ?? "") : r.company_details,
      paymentInstructions: draft ? (company?.payment_instructions ?? "") : r.payment_instructions,
      logoUrl: company?.logo_url ?? null,
    },
    client: draft ? { name: client?.name ?? "", email: client?.email ?? "" } : { name: r.client_name, email: r.client_email },
    project: draft ? { name: live?.name ?? "", location: live?.location ?? "" } : { name: r.project_name, location: r.project_location },
    sentAt: r.sent_at,
    cancelledAt: r.cancelled_at,
    cancelReason: r.cancel_reason,
  };
}
