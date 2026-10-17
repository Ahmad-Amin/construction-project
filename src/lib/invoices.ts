import type { SupabaseClient } from "@supabase/supabase-js";
import { currencyOrDefault } from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import { one } from "@/lib/types";

// Invoices the company owner creates and sends to the project's homeowner. The database decides who can do what and
// works out the totals; this file loads them for the screens and the PDF.
export type InvoiceStatus = "draft" | "sent" | "cancelled";
export type InvoiceLine = { description: string; amount: number };

export const invoiceStatusLabel: Record<InvoiceStatus, string> = { draft: "Draft", sent: "Sent", cancelled: "Cancelled" };

// Where a sent invoice stands, worked out from the confirmed payments that say they are for it: paid once they cover
// the total, otherwise unpaid (overdue after the due date).
export type PaidState = "paid" | "unpaid" | "overdue";
export const paidStateLabel: Record<PaidState, string> = { paid: "Paid", unpaid: "Unpaid", overdue: "Overdue" };

export function paidState(total: number, paid: number, dueDate: string | null, today: string): PaidState {
  if (paid >= total) return "paid";
  return dueDate !== null && dueDate < today ? "overdue" : "unpaid";
}

type PaymentLink = { amount: number | string; status: "pending" | "confirmed" | "disputed" };
// What confirmed payments cover, and what is waiting for confirmation. Row-level security decides which payments are
// counted, and everyone who can see an invoice can see the project's payments.
function paidFrom(payments: PaymentLink[] | null | undefined) {
  let paid = 0;
  let awaiting = 0;
  for (const p of payments ?? []) {
    if (p.status === "confirmed") paid += Number(p.amount);
    else if (p.status === "pending") awaiting += Number(p.amount);
  }
  return { paid, awaiting };
}

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
  // Confirmed payments for it, payments waiting for confirmation, and what is left to pay.
  paid: number;
  awaiting: number;
  balance: number;
  scheduleItemId: string | null;
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

// Row-level security decides what comes back: the owner (and staff allowed to invoice) get every invoice of the project,
// the homeowner only the ones that were sent (and cancelled ones), everyone else nothing.
export async function fetchInvoices(supabase: SupabaseClient, projectId: string): Promise<InvoiceListItem[]> {
  const { data } = await supabase
    .from("invoices")
    .select("id, status, number, issue_date, due_date, total, currency, lines, schedule_item_id, payments(amount, status)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);
  type ListRow = Pick<Row, "id" | "status" | "number" | "issue_date" | "due_date" | "total" | "currency" | "lines" | "schedule_item_id"> & {
    payments: PaymentLink[] | null;
  };
  return ((data ?? []) as ListRow[]).map((r) => {
    const total = Number(r.total);
    const { paid, awaiting } = paidFrom(r.payments);
    return {
      id: r.id,
      status: r.status,
      number: r.number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      total,
      currency: r.currency,
      summary: r.lines.length === 1 ? r.lines[0].description : `${r.lines[0]?.description ?? ""}${r.lines.length > 1 ? ` and ${r.lines.length - 1} more` : ""}`,
      paid,
      awaiting,
      balance: Math.max(total - paid, 0),
      scheduleItemId: r.schedule_item_id,
    };
  });
}

// For the money summary: what was invoiced (sent invoices; cancelled ones don't count), what of that is still to be
// paid, and how many drafts are waiting.
export function invoiceSummary(invoices: InvoiceListItem[]) {
  const sent = invoices.filter((i) => i.status === "sent");
  return {
    total: sent.reduce((sum, i) => sum + i.total, 0),
    outstanding: sent.reduce((sum, i) => sum + i.balance, 0),
    count: sent.length,
    drafts: invoices.filter((i) => i.status === "draft").length,
  };
}

export type InvoiceSummary = ReturnType<typeof invoiceSummary>;

// Whether a payment can be recorded for this invoice now: it was sent, isn't paid, and no payment for it is waiting
// for confirmation (a payment for an invoice pays all of it, so there is only ever one at a time).
export const canPayInvoice = (i: { status: InvoiceStatus; balance: number; awaiting: number }) =>
  i.status === "sent" && i.balance > 0 && i.awaiting === 0;

export type InvoiceOption = { id: string; label: string; amount: number | null };

// The invoices a payment can say it is for (and the one it is already for, when editing), with the amount the payment
// must be: what is left to pay. The database checks the same. A cancelled invoice no longer sets the amount.
export function invoiceOptions(invoices: InvoiceListItem[], current: string | null = null): InvoiceOption[] {
  return invoices
    .filter((i) => canPayInvoice(i) || i.id === current)
    .map((i) => ({
      id: i.id,
      label: `${invoiceNumber(i.number)} · ${i.status === "sent" ? `${formatMoney(i.balance, i.currency)} to pay` : invoiceStatusLabel[i.status].toLowerCase()}`,
      amount: i.status === "sent" ? i.balance : null,
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
  // The payments that say they are for this invoice (the ones this person can see).
  payments: { id: string; amount: number; date: string; status: "pending" | "confirmed" | "disputed"; side: "contractor" | "client" }[];
  paid: number;
  awaiting: number;
  balance: number;
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
  const [invoiceRes, liveRes, paymentsRes] = await Promise.all([
    supabase.from("invoices").select(COLUMNS).eq("id", invoiceId).eq("project_id", projectId).maybeSingle(),
    supabase
      .from("projects")
      .select("name, location, client:clients(name, email), company:companies(name, logo_url, invoice_details, payment_instructions, currency)")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("id, amount, payment_date, status, side")
      .eq("project_id", projectId)
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: false })
      .limit(100),
  ]);
  const r = invoiceRes.data as Row | null;
  if (!r) return null;
  const live = liveRes.data as Live | null;
  const company = one(live?.company ?? null);
  const client = one(live?.client ?? null);
  const draft = r.status === "draft";
  const payments = ((paymentsRes.data ?? []) as { id: string; amount: number; payment_date: string; status: PaymentLink["status"]; side: "contractor" | "client" }[]).map(
    (p) => ({ id: p.id, amount: Number(p.amount), date: p.payment_date, status: p.status, side: p.side }),
  );
  const { paid, awaiting } = paidFrom(payments);

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
    payments,
    paid,
    awaiting,
    balance: Math.max(Number(r.total) - paid, 0),
  };
}
