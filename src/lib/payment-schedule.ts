import type { SupabaseClient } from "@supabase/supabase-js";

// The payment schedule is a plan, not a record: it says what the contractor expects and when.
// Real payments live in the payments table; one can say which instalment it settles, and that
// is how an instalment moves to "paid". Nothing here creates or changes a payment.

export type ScheduleStatus = "upcoming" | "due" | "awaiting" | "paid";

export type ScheduleItem = {
  id: string;
  title: string;
  amount: number;
  // The stage that makes it due, or null when it is due from the start of the work.
  stageId: string | null;
  stageName: string | null;
  stageDone: boolean;
  confirmed: number;
  pending: number;
  // What is still unaccounted for: not confirmed and not waiting for confirmation.
  left: number;
  status: ScheduleStatus;
  remindedAt: string | null;
};

export type Stage = { id: string; name: string; position: number; done: boolean };

type ItemRow = {
  id: string;
  title: string;
  amount: number;
  milestone_id: string | null;
  reminded_at: string | null;
};
type LinkedPayment = { schedule_item_id: string; amount: number; status: "pending" | "confirmed" | "disputed" };

// Disputed payments don't count; pending ones do (the homeowner has said they paid).
export function scheduleStatus(p: {
  amount: number;
  stageDone: boolean;
  confirmed: number;
  pending: number;
}): { status: ScheduleStatus; left: number } {
  const left = Math.max(0, p.amount - p.confirmed - p.pending);
  if (p.confirmed >= p.amount) return { status: "paid", left };
  if (left === 0) return { status: "awaiting", left };
  return { status: p.stageDone ? "due" : "upcoming", left };
}

export async function fetchStages(supabase: SupabaseClient, projectId: string): Promise<Stage[]> {
  const { data } = await supabase
    .from("milestones")
    .select("id, name, position, status")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  return ((data ?? []) as { id: string; name: string; position: number; status: string }[]).map((m) => ({
    id: m.id,
    name: m.name,
    position: m.position,
    done: m.status === "done",
  }));
}

// The schedule in the order things happen: from the start, then stage by stage.
export async function fetchSchedule(
  supabase: SupabaseClient,
  projectId: string,
  stages?: Stage[],
): Promise<ScheduleItem[]> {
  const [itemsRes, paymentsRes, stageList] = await Promise.all([
    supabase
      .from("scheduled_payments")
      .select("id, title, amount, milestone_id, reminded_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(60),
    supabase
      .from("payments")
      .select("schedule_item_id, amount, status")
      .eq("project_id", projectId)
      .not("schedule_item_id", "is", null)
      .limit(2000),
    stages ? Promise.resolve(stages) : fetchStages(supabase, projectId),
  ]);

  const byStage = new Map(stageList.map((s) => [s.id, s]));
  const linked = (paymentsRes.data ?? []) as LinkedPayment[];

  return ((itemsRes.data ?? []) as ItemRow[])
    .map((row) => {
      const stage = row.milestone_id ? byStage.get(row.milestone_id) : undefined;
      const mine = linked.filter((p) => p.schedule_item_id === row.id);
      const sum = (status: LinkedPayment["status"]) =>
        mine.filter((p) => p.status === status).reduce((s, p) => s + Number(p.amount), 0);
      const amount = Number(row.amount);
      const confirmed = sum("confirmed");
      const pending = sum("pending");
      const stageDone = row.milestone_id === null ? true : (stage?.done ?? false);
      return {
        id: row.id,
        title: row.title,
        amount,
        stageId: row.milestone_id,
        stageName: stage?.name ?? null,
        stageDone,
        confirmed,
        pending,
        remindedAt: row.reminded_at,
        order: stage ? stage.position : -1,
        ...scheduleStatus({ amount, stageDone, confirmed, pending }),
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const { order, ...rest } = item;
      void order;
      return rest;
    });
}

export type ScheduleTotals = { scheduled: number; paid: number; awaiting: number; due: number };

export function scheduleTotals(items: ScheduleItem[]): ScheduleTotals {
  return {
    scheduled: items.reduce((s, i) => s + i.amount, 0),
    paid: items.reduce((s, i) => s + Math.min(i.confirmed, i.amount), 0),
    awaiting: items.reduce((s, i) => s + i.pending, 0),
    due: items.filter((i) => i.status === "due").reduce((s, i) => s + i.left, 0),
  };
}
