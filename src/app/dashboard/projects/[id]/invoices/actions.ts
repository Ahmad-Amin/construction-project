"use server";

import { revalidatePath } from "next/cache";
import { MAX_LINES } from "@/lib/invoices";
import { queueNotificationDelivery } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export type InvoiceResult = { error?: string; number?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const GENERIC = "Something went wrong. Please try again.";

// The database raises plain-English messages (error code P0001) for every rule; show those as they are.
const friendly = (error: { code?: string; message: string }) => (error.code === "P0001" ? error.message : GENERIC);

const refresh = (projectId: string) => revalidatePath(`/dashboard/projects/${projectId}`, "layout");

export type InvoiceInput = {
  issueDate: string;
  dueDate: string | null;
  lines: { description: string; amount: number }[];
  taxLabel: string;
  taxRate: number | null;
  note: string;
  scheduleItemId: string | null;
};

// Creates the draft, or changes it while it is still a draft. The id is made in the browser, so a double tap or a retry
// never creates two invoices.
export async function saveInvoice(projectId: string, invoiceId: string, input: InvoiceInput): Promise<InvoiceResult> {
  if (!UUID.test(projectId) || !UUID.test(invoiceId)) return { error: GENERIC };
  if (!DAY.test(input?.issueDate ?? "")) return { error: "Please choose the invoice date." };
  if (input.dueDate && !DAY.test(input.dueDate)) return { error: "Please choose a valid due date." };
  if (!Array.isArray(input.lines) || input.lines.length === 0) return { error: "Please add at least one line." };
  if (input.lines.length > MAX_LINES) return { error: `Please keep an invoice to ${MAX_LINES} lines or fewer.` };
  const lines = input.lines.map((l) => ({ description: String(l?.description ?? "").trim(), amount: Number(l?.amount) }));
  if (input.scheduleItemId && !UUID.test(input.scheduleItemId)) return { error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_invoice", {
    p_id: invoiceId,
    p_project: projectId,
    p_issue_date: input.issueDate,
    p_due_date: input.dueDate || null,
    p_lines: lines,
    p_tax_label: String(input.taxLabel ?? ""),
    p_tax_rate: input.taxRate === null || input.taxRate === undefined ? null : Number(input.taxRate),
    p_note: String(input.note ?? ""),
    p_schedule_item: input.scheduleItemId || null,
  });
  if (error) return { error: friendly(error) };
  refresh(projectId);
  return {};
}

// Gives the invoice its number, locks it and tells the homeowner (bell and email).
export async function sendInvoice(projectId: string, invoiceId: string): Promise<InvoiceResult> {
  if (!UUID.test(projectId) || !UUID.test(invoiceId)) return { error: GENERIC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_invoice", { p_id: invoiceId });
  if (error) return { error: friendly(error) };
  queueNotificationDelivery();
  refresh(projectId);
  return { number: Number(data) };
}

export async function cancelInvoice(projectId: string, invoiceId: string, reason: string): Promise<InvoiceResult> {
  if (!UUID.test(projectId) || !UUID.test(invoiceId)) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_invoice", { p_id: invoiceId, p_reason: String(reason ?? "").slice(0, 300) });
  if (error) return { error: friendly(error) };
  queueNotificationDelivery();
  refresh(projectId);
  return {};
}

export async function deleteInvoiceDraft(projectId: string, invoiceId: string): Promise<InvoiceResult> {
  if (!UUID.test(projectId) || !UUID.test(invoiceId)) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_invoice_draft", { p_id: invoiceId });
  if (error) return { error: friendly(error) };
  refresh(projectId);
  return {};
}
