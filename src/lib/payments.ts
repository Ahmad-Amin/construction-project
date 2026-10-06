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
};

export const PAYMENT_COLUMNS =
  "id, amount, payment_date, reference, note, side, status, created_by, created_by_name, edited, responded_by_name, responded_at, dispute_reason";

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
  };
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
  return ((data ?? []) as Row[]).map(toPaymentItem);
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
