import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchUpdatesByIds, type UpdateItem } from "@/lib/updates";
import type { ExpenseCategory } from "@/lib/expenses";
import type { PaymentSide, PaymentStatus } from "@/lib/payments";

type Base = { id: string; date: string; occurredAt: string; actorName: string };

export type TimelineEvent =
  | (Base & { kind: "update"; update: UpdateItem })
  | (Base & { kind: "expense"; title: string; category: ExpenseCategory; amount: number })
  | (Base & {
      kind: "payment";
      title: string;
      note: string;
      amount: number;
      status: PaymentStatus;
      side: PaymentSide;
    })
  | (Base & {
      kind: "payment_response";
      amount: number;
      status: PaymentStatus;
      side: PaymentSide;
      reason: string;
    });

type Row = {
  kind: "update" | "expense" | "payment" | "payment_response";
  item_id: string;
  event_date: string;
  occurred_at: string;
  actor_name: string | null;
  title: string | null;
  detail: string | null;
  amount: number | null;
  status: PaymentStatus | null;
  side: PaymentSide | null;
};

export type Timeline = { events: TimelineEvent[]; hasMore: boolean };

// The feed is assembled in the database as the signed-in user, so it only
// ever contains what that person is allowed to see.
export async function fetchTimeline(
  supabase: SupabaseClient,
  projectId: string,
  limit: number,
): Promise<Timeline> {
  // Ask for one extra row to know whether there is more to show.
  const { data } = await supabase.rpc("project_timeline", {
    p_project_id: projectId,
    p_limit: limit + 1,
  });
  const all = (data ?? []) as Row[];
  const rows = all.slice(0, limit);

  // Updates carry photos, so load those for just this page of the feed.
  const updates = await fetchUpdatesByIds(
    supabase,
    rows.filter((r) => r.kind === "update").map((r) => r.item_id),
  );
  const updateById = new Map(updates.map((u) => [u.id, u]));

  const events: TimelineEvent[] = [];
  for (const r of rows) {
    const base: Base = {
      id: `${r.kind}-${r.item_id}`,
      date: r.event_date,
      occurredAt: r.occurred_at,
      actorName: r.actor_name ?? "",
    };

    if (r.kind === "update") {
      const update = updateById.get(r.item_id);
      if (update) events.push({ ...base, kind: "update", update });
    } else if (r.kind === "expense") {
      events.push({
        ...base,
        kind: "expense",
        title: r.title ?? "",
        category: (r.detail ?? "other") as ExpenseCategory,
        amount: Number(r.amount ?? 0),
      });
    } else if (r.kind === "payment") {
      events.push({
        ...base,
        kind: "payment",
        title: r.title ?? "",
        note: r.detail ?? "",
        amount: Number(r.amount ?? 0),
        status: r.status ?? "pending",
        side: r.side ?? "contractor",
      });
    } else {
      events.push({
        ...base,
        kind: "payment_response",
        amount: Number(r.amount ?? 0),
        status: r.status ?? "confirmed",
        side: r.side ?? "contractor",
        reason: r.title ?? "",
      });
    }
  }

  return { events, hasMore: all.length > limit };
}
