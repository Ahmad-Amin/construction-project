import { platformAdminEmails } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

// A bell notification for the people on the plans-admin allow-list. It is only ever a convenience added
// AFTER the real work (the feedback is saved and emailed, the plan request is recorded and emailed), so
// it never throws and never stops anything: if it can't be sent, it is logged and forgotten.
export async function notifyPlatformAdmins(input: {
  kind: "feedback_received" | "plan_requested";
  title: string;
  body: string;
  // A path inside the app.
  link: string;
  // Whoever caused it, so they are not notified about their own action.
  actorId: string | null;
}): Promise<void> {
  try {
    const emails = platformAdminEmails();
    if (emails.length === 0) return;
    const { error } = await createAdminClient().rpc("notify_platform_admins", {
      p_emails: emails,
      p_actor: input.actorId,
      p_kind: input.kind,
      p_title: input.title,
      p_body: input.body,
      p_link: input.link,
    });
    if (error) console.error("[admin-notify] could not create the notification:", error.message);
  } catch (error) {
    console.error("[admin-notify] failed:", error instanceof Error ? error.message : error);
  }
}
