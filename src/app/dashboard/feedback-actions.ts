"use server";

import { escapeHtml, sendEmail } from "@/lib/email";
import { adminInbox } from "@/lib/inbox";
import { notifyPlatformAdmins } from "@/lib/admin-notify";
import { getOrigin } from "@/lib/origin";
import { PRODUCT_NAME } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export type FeedbackResult = { ok: boolean; message: string };
const CATEGORIES = ["problem", "idea", "question"] as const;
const LABEL = { problem: "Problem", idea: "Idea", question: "Question" } as const;

// A signed-in person sends feedback. It is saved first (that is the record that matters), then emailed
// to us. If the email can't be sent the feedback is still safe in the database, and the person is not told
// anything went wrong.
export async function sendFeedback(category: string, message: string, page: string, browser: string): Promise<FeedbackResult> {
  if (!(CATEGORIES as readonly string[]).includes(category)) return { ok: false, message: "Please choose what kind of message this is." };
  const text = message.trim();
  if (text.length < 3) return { ok: false, message: "Please write a few words." };
  if (text.length > 2000) return { ok: false, message: "Please keep it under 2,000 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_feedback", {
    p_category: category,
    p_message: text,
    p_page: page.slice(0, 300),
    p_browser: browser.slice(0, 300),
  });
  if (error) return { ok: false, message: error.code === "P0001" ? error.message : "We couldn't send that. Please try again." };

  const r = data as { result: "ok" | "too_soon"; email?: string; name?: string; role?: string; company_name?: string };
  if (r.result === "too_soon") {
    return { ok: false, message: "You've sent a few messages in the last hour. Please try again a little later." };
  }

  const to = adminInbox("feedback");
  if (to) {
    const kind = LABEL[category as (typeof CATEGORIES)[number]];
    const who = [r.name, r.email].filter(Boolean).join(" · ") || "unknown";
    const where = [r.role, r.company_name].filter(Boolean).join(" · ");
    const adminUrl = `${await getOrigin()}/dashboard/admin/feedback`;
    const e = escapeHtml;
    const result = await sendEmail({
      to,
      subject: `${PRODUCT_NAME} feedback (${kind.toLowerCase()}): ${text.replace(/\s+/g, " ").slice(0, 60)}`,
      text: [`${kind} from ${who}${where ? ` (${where})` : ""}`, "", text, "", `Page: ${page || "unknown"}`, `Browser: ${browser || "unknown"}`, "", `Reply to this email to answer them. All feedback: ${adminUrl}`].join("\n"),
      html: `<!doctype html><html lang="en"><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
      <tr><td style="background:#f59e0b;padding:18px 24px;font-size:16px;font-weight:700;color:#1c1917;">${e(PRODUCT_NAME)}: feedback</td></tr>
      <tr><td style="padding:28px 24px;">
        <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#78716c;">${e(kind)}</p>
        <p style="margin:0 0 16px 0;font-size:14px;color:#44403c;"><strong>${e(who)}</strong>${where ? `<br><span style="color:#78716c;">${e(where)}</span>` : ""}</p>
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#1c1917;white-space:pre-wrap;">${e(text)}</p>
        <p style="margin:0 0 4px 0;font-size:12px;color:#78716c;">Page: ${e(page || "unknown")}</p>
        <p style="margin:0 0 20px 0;font-size:12px;color:#78716c;word-break:break-all;">Browser: ${e(browser || "unknown")}</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#44403c;">Reply to this email to answer them, or see <a href="${e(adminUrl)}" style="color:#44403c;">all feedback</a>.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`,
      replyTo: r.email || undefined,
    });
    if (!result.ok) console.error("[feedback] could not email it (it is saved):", result.error);
  }

  // The bell, for the people running the service. After everything above, and never in the way of it.
  const viewer = await getViewer();
  const who2 = [r.name, r.email].filter(Boolean).join(" · ") || "Someone";
  await notifyPlatformAdmins({
    kind: "feedback_received",
    title: `Feedback (${LABEL[category as (typeof CATEGORIES)[number]].toLowerCase()}) from ${who2}`,
    body: text.replace(/\s+/g, " ").slice(0, 200),
    link: "/dashboard/admin/feedback",
    actorId: viewer?.userId ?? null,
  });

  return { ok: true, message: "Thank you. We read every message." };
}
