import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentSide = "contractor" | "client";
export type PaymentStatus = "pending" | "confirmed" | "disputed";

export const sideLabel: Record<PaymentSide, string> = {
  contractor: "Contractor",
  client: "Homeowner",
};

export type PaymentItem = {
  id: string;
  amount: number;
  date: string;
  reference: string;
  note: string;
  side: PaymentSide;
  status: PaymentStatus;
  createdBy: string;
  createdByName: string;
  edited: boolean;
  respondedByName: string;
  respondedAt: string | null;
  disputeReason: string | null;
  // Optional proof of payment (a photo). The link is signed and short-lived; null when there is none.
  receiptPath: string | null;
  receiptUrl: string | null;
  // The scheduled instalment this payment settles, when it says so.
  scheduleItemId: string | null;
};

type Row = {
  id: string;
  amount: number;
  payment_date: string;
  reference: string;
  note: string;
  side: PaymentSide;
  status: PaymentStatus;
  created_by: string;
  created_by_name: string;
  edited: boolean;
  responded_by_name: string;
  responded_at: string | null;
  dispute_reason: string | null;
  receipt_path: string | null;
  schedule_item_id: string | null;
};

export const PAYMENT_COLUMNS =
  "id, amount, payment_date, reference, note, side, status, created_by, created_by_name, edited, responded_by_name, responded_at, dispute_reason, receipt_path, schedule_item_id";

export function toPaymentItem(r: Row): PaymentItem {
  return {
    id: r.id,
    amount: Number(r.amount),
    date: r.payment_date,
    reference: r.reference,
    note: r.note,
    side: r.side,
    status: r.status,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    edited: r.edited,
    respondedByName: r.responded_by_name,
    respondedAt: r.responded_at,
    disputeReason: r.dispute_reason,
    receiptPath: r.receipt_path,
    receiptUrl: null,
    scheduleItemId: r.schedule_item_id,
  };
}

// Adds a signed link to every payment that has a receipt. Row-level security decides who may
// read each file, so a link is only ever made for someone allowed to see it.
export async function withReceiptUrls(supabase: SupabaseClient, items: PaymentItem[]): Promise<PaymentItem[]> {
  const paths = items.flatMap((p) => (p.receiptPath ? [p.receiptPath] : []));
  if (paths.length === 0) return items;
  const { data } = await supabase.storage.from("project-media").createSignedUrls(paths, 3600);
  const urls = new Map((data ?? []).flatMap((e) => (e.path && e.signedUrl ? [[e.path, e.signedUrl] as const] : [])));
  return items.map((p) => ({ ...p, receiptUrl: p.receiptPath ? (urls.get(p.receiptPath) ?? null) : null }));
}

export async function fetchPayments(
  supabase: SupabaseClient,
  projectId: string,
  limit: number,
): Promise<PaymentItem[]> {
  const { data } = await supabase
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("project_id", projectId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return withReceiptUrls(supabase, ((data ?? []) as Row[]).map(toPaymentItem));
}

export type PaymentTotals = {
  confirmedTotal: number;
  confirmedCount: number;
  pendingTotal: number;
  pendingCount: number;
  disputedCount: number;
  // Pending payments waiting on the homeowner / on the owner.
  awaitingClient: number;
  awaitingOwner: number;
};

export async function fetchPaymentTotals(
  supabase: SupabaseClient,
  projectId: string,
): Promise<PaymentTotals> {
  const { data } = await supabase.rpc("project_payment_totals", { p_project_id: projectId });
  const row = data?.[0];
  return {
    confirmedTotal: Number(row?.confirmed_total ?? 0),
    confirmedCount: Number(row?.confirmed_count ?? 0),
    pendingTotal: Number(row?.pending_total ?? 0),
    pendingCount: Number(row?.pending_count ?? 0),
    disputedCount: Number(row?.disputed_count ?? 0),
    awaitingClient: Number(row?.awaiting_client_count ?? 0),
    awaitingOwner: Number(row?.awaiting_owner_count ?? 0),
  };
}

// Which side of a project the signed-in person is on (null for staff, who only view).
export function viewerSide(isTeam: boolean, isOwner: boolean): PaymentSide | null {
  if (!isTeam) return "client";
  return isOwner ? "contractor" : null;
}

// How many pending payments are waiting for this person to respond.
export function awaitingMyResponse(totals: PaymentTotals, side: PaymentSide | null) {
  if (side === "client") return totals.awaitingClient;
  if (side === "contractor") return totals.awaitingOwner;
  return 0;
}
