import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { renderNotificationEmail, sendEmail } from "@/lib/email";
import { getOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export type NotificationKind =
  | "payment_recorded"
  | "payment_confirmed"
  | "payment_disputed"
  | "update_posted"
  | "milestone_completed"
  | "client_joined"
  | "project_completed";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  createdAt: string;
  read: boolean;
};

type Row = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  created_at: string;
  read_at: string | null;
};

// Row-level security means this is only ever the signed-in person's own notifications.
export async function fetchNotifications(supabase: SupabaseClient, limit: number): Promise<NotificationItem[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    link: r.link,
    createdAt: r.created_at,
    read: r.read_at !== null,
  }));
}

export async function countUnread(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

// Sends the emails for notifications the signed-in person just caused. Call it at the end of
// an action that can notify someone: it runs after the response, so it never slows the page.
// The database does the matching: this person can only claim emails they triggered.
export function queueEmailDelivery() {
  after(async () => {
    try {
      await deliverPendingEmails();
    } catch (error) {
      console.error("[notifications] email delivery failed", error);
    }
  });
}

async function deliverPendingEmails() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_email_notifications", { p_limit: 20 });
  if (error || !data?.length) return;

  const origin = await getOrigin();
  const rows = data as {
    id: string;
    to_email: string;
    title: string;
    body: string;
    link: string;
    project_name: string | null;
  }[];

  await Promise.all(
    rows.map(async (row) => {
      const result = await sendEmail(
        renderNotificationEmail({
          to: row.to_email,
          title: row.title,
          body: row.body,
          projectName: row.project_name,
          linkUrl: `${origin}${row.link}`,
          settingsUrl: `${origin}/dashboard/settings`,
        }),
      );
      await supabase.rpc("finish_email_notification", {
        p_id: row.id,
        p_ok: result.ok,
        p_error: result.ok ? null : result.error,
      });
    }),
  );
}
