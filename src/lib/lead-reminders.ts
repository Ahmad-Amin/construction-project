import type { SupabaseClient } from "@supabase/supabase-js";
import { renderNotificationEmail, sendEmail } from "@/lib/email";
import { sendWhatsAppTemplate } from "@/lib/whatsapp-api";

// The daily follow-up reminders. The database decides who is due (claim_lead_reminders, migration 50): one reminder per
// person per day, about the follow-ups on their next day, already added to their in-app notifications. This sends the
// email and, on the paid plans, the WhatsApp message, and reports each one back. `admin` must be the secret-key client.

export type LeadReminderRun = { due: number; emailed: number; whatsapped: number; failed: number; error?: string };

type Row = {
  out_notification_id: string;
  out_email: string | null;
  out_whatsapp_to: string | null;
  out_name: string;
  out_title: string;
  out_body: string;
  out_due: number;
  out_when: "today" | "tomorrow";
};

export async function sendLeadReminders(admin: SupabaseClient, origin: string): Promise<LeadReminderRun> {
  const { data, error } = await admin.rpc("claim_lead_reminders");
  if (error) return { due: 0, emailed: 0, whatsapped: 0, failed: 0, error: error.message };
  const rows = (data ?? []) as Row[];
  const link = `${origin}/dashboard/leads?due=1`;

  let emailed = 0;
  let whatsapped = 0;
  let failed = 0;

  async function remind(row: Row) {
    if (row.out_email) {
      let ok = false;
      let reason = "";
      try {
        const result = await sendEmail(
          renderNotificationEmail({
            to: row.out_email,
            title: row.out_title,
            body: row.out_body,
            projectName: null,
            linkUrl: link,
            settingsUrl: `${origin}/dashboard/settings#notifications`,
          }),
        );
        ok = result.ok;
        if (!result.ok) reason = result.error;
      } catch (err) {
        reason = err instanceof Error ? err.message : "Unknown error";
      }
      await admin.rpc("finish_lead_reminder_email", { p_id: row.out_notification_id, p_ok: ok, p_error: reason || null });
      if (ok) emailed++;
      else {
        failed++;
        console.error("[lead-reminders] email", row.out_notification_id, reason);
      }
    }

    if (row.out_whatsapp_to) {
      const count = `${row.out_due} lead ${row.out_due === 1 ? "follow-up" : "follow-ups"}`;
      const result = await sendWhatsAppTemplate(row.out_whatsapp_to, "lead_follow_ups", [row.out_name || "there", count, row.out_when, link]);
      await admin.rpc("finish_lead_reminder_whatsapp", {
        p_id: row.out_notification_id,
        p_ok: result.ok,
        p_error: result.ok ? null : result.error,
      });
      if (result.ok) whatsapped++;
      else {
        failed++;
        console.error("[lead-reminders] WhatsApp", row.out_notification_id, result.error);
      }
    }
  }

  // A few at a time, so the run stays well inside the job's time limit.
  for (let i = 0; i < rows.length; i += 5) await Promise.all(rows.slice(i, i + 5).map(remind));
  return { due: rows.length, emailed, whatsapped, failed };
}
