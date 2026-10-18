import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, sendEmail, type Email } from "@/lib/email";
import { PRODUCT_NAME } from "@/lib/site";

// One friendly reminder for people who signed up with email and password but haven't confirmed their email after a day
// (migration 46 decides who and makes sure it is only ever once). Run by the daily job.

// At most this many a day: the email service's daily allowance is shared with notifications.
const PER_RUN = 50;

export function renderSignupReminderEmail(input: { to: string; name: string; link: string; signInUrl: string }): Email {
  const first = input.name.trim().split(/\s+/)[0] ?? "";
  const hello = first ? `Hi ${first},` : "Hi,";
  const subject = `Confirm your email to finish setting up ${PRODUCT_NAME}`;
  const lead = `You started creating a ${PRODUCT_NAME} account, but your email isn't confirmed yet. Tap the button to confirm it and sign in.`;
  const expiry = `For your security the button works for a limited time. If it has expired, sign in with your email and password and we'll send you a new link.`;
  const footer = `Didn't create a ${PRODUCT_NAME} account? You can ignore this email. This is the only reminder we'll send.`;

  const text = [hello, "", lead, "", `Confirm your email: ${input.link}`, "", expiry, `Sign in: ${input.signInUrl}`, "", "---", footer].join("\n");

  // Inline styles and tables, because email apps ignore most modern CSS (the same look as the notification emails).
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
        <tr><td style="background:#f59e0b;padding:18px 24px;font-size:16px;font-weight:700;color:#1c1917;">${escapeHtml(PRODUCT_NAME)}</td></tr>
        <tr><td style="padding:28px 24px 8px 24px;">
          <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;color:#1c1917;">Your account is almost ready</h1>
          <p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#44403c;">${escapeHtml(hello)}</p>
          <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#44403c;">${escapeHtml(lead)}</p>
          <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#f59e0b;color:#1c1917;font-weight:700;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:10px;">Confirm my email</a>
          <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#78716c;">${escapeHtml(expiry)} <a href="${escapeHtml(input.signInUrl)}" style="color:#78716c;">Sign in</a></p>
        </td></tr>
        <tr><td style="padding:24px;font-size:12px;line-height:1.6;color:#78716c;">${escapeHtml(footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { to: input.to, subject, text, html };
}

export type ReminderRun = { sent: number; failed: number; error?: string };

// Claims the people who are due, makes each a fresh one-time link and emails it. A reminder that couldn't be sent is
// released, so tomorrow's run tries again. `admin` must be the secret-key client.
export async function sendSignupReminders(admin: SupabaseClient, origin: string): Promise<ReminderRun> {
  const { data, error } = await admin.rpc("claim_signup_reminders", { p_limit: PER_RUN });
  if (error) return { sent: 0, failed: 0, error: error.message };
  const rows = (data ?? []) as { out_user_id: string; out_email: string; out_name: string }[];

  let sent = 0;
  let failed = 0;
  async function remind(row: (typeof rows)[number]) {
    try {
      // A "recovery" link: opening it confirms the email and signs them in, and it can never create an account (see
      // CONFIRM_LINK_TYPES in lib/auth-flow.ts). It doesn't send anything by itself; we send the email.
      const { data: generated, error: linkError } = await admin.auth.admin.generateLink({ type: "recovery", email: row.out_email });
      const tokenHash = generated?.properties?.hashed_token;
      if (linkError || !tokenHash) throw new Error(linkError?.message ?? "No link came back.");

      const result = await sendEmail(
        renderSignupReminderEmail({
          to: row.out_email,
          name: row.out_name,
          link: `${origin}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`,
          signInUrl: `${origin}/login`,
        }),
      );
      if (!result.ok) throw new Error(result.error);
      sent++;
    } catch (err) {
      failed++;
      console.error("[signup-reminders] could not send a reminder", row.out_user_id, err instanceof Error ? err.message : err);
      await admin.rpc("release_signup_reminder", { p_user: row.out_user_id });
    }
  }

  // A few at a time, so the run stays well inside the job's time limit without flooding the email service.
  for (let i = 0; i < rows.length; i += 5) await Promise.all(rows.slice(i, i + 5).map(remind));
  return { sent, failed };
}
