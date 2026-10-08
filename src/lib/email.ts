import nodemailer, { type Transporter } from "nodemailer";
import { PRODUCT_NAME } from "@/lib/site";

// A thin layer over whichever service actually sends the email, so changing provider is a
// settings change, not a code change.
//
//   EMAIL_PROVIDER=smtp      Any SMTP server (Gmail app password, Mailtrap, your host...)
//   EMAIL_PROVIDER=ethereal  Free fake inbox for testing: nothing is ever delivered to a real
//                            address. Every email lands in an Ethereal inbox you can open in the
//                            browser, and the server console prints a preview link for each one.
//                            Default in development. Set ETHEREAL_USER and ETHEREAL_PASS (create
//                            an account at https://ethereal.email/create) to keep ONE inbox across
//                            restarts; without them a new throwaway inbox is made on every start.
//   EMAIL_PROVIDER=resend    Resend's HTTP API (set RESEND_API_KEY). For production.
//   EMAIL_PROVIDER=none      Don't send (the default outside development with nothing configured).

export type Email = { to: string; subject: string; text: string; html: string };
export type SendResult = { ok: true; preview?: string } | { ok: false; error: string };

type Provider = "smtp" | "ethereal" | "resend" | "none";

function provider(): Provider {
  const chosen = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
  if (chosen === "smtp" || chosen === "ethereal" || chosen === "resend" || chosen === "none") return chosen;
  if (process.env.SMTP_HOST) return "smtp";
  return process.env.NODE_ENV === "production" ? "none" : "ethereal";
}

const from = () => process.env.EMAIL_FROM || `${PRODUCT_NAME} <no-reply@example.com>`;

// One transporter per server process.
let transporter: Promise<Transporter> | null = null;

function getTransporter(kind: "smtp" | "ethereal"): Promise<Transporter> {
  transporter ??= (async () => {
    if (kind === "ethereal") {
      const { ETHEREAL_USER, ETHEREAL_PASS } = process.env;
      if (ETHEREAL_USER && ETHEREAL_PASS) {
        return nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: { user: ETHEREAL_USER, pass: ETHEREAL_PASS },
        });
      }
      const account = await nodemailer.createTestAccount();
      console.log(
        `[email] New Ethereal inbox for this server run. Sign in at https://ethereal.email/login with ${account.user} / ${account.pass} to see every email. ` +
          "Set ETHEREAL_USER and ETHEREAL_PASS in .env.local to keep one inbox across restarts.",
      );
      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
    }
    const port = Number(process.env.SMTP_PORT ?? 587);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // Port 465 is encrypted from the start; 587 upgrades the connection after connecting.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  })();
  return transporter;
}

export async function sendEmail(email: Email): Promise<SendResult> {
  const kind = provider();
  try {
    if (kind === "none") {
      return { ok: false, error: "Email is not configured (set EMAIL_PROVIDER or SMTP_HOST)." };
    }

    if (kind === "resend") {
      const key = process.env.RESEND_API_KEY;
      if (!key) return { ok: false, error: "RESEND_API_KEY is not set." };
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from(),
          to: [email.to],
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      });
      if (!response.ok) return { ok: false, error: `Resend ${response.status}: ${(await response.text()).slice(0, 200)}` };
      return { ok: true };
    }

    const info = await (await getTransporter(kind)).sendMail({
      from: from(),
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    const preview = kind === "ethereal" ? (nodemailer.getTestMessageUrl(info) || undefined) : undefined;
    if (preview) console.log(`[email] "${email.subject}" to ${email.to}. Preview: ${preview}`);
    return { ok: true, preview };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not send the email." };
  }
}

// ---------------------------------------------------------------------------
// The email people receive for a notification.
// ---------------------------------------------------------------------------
export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderNotificationEmail(input: {
  to: string;
  title: string;
  body: string;
  projectName: string | null;
  linkUrl: string;
  settingsUrl: string;
}): Email {
  const { title, body, projectName, linkUrl, settingsUrl } = input;

  const text = [
    title,
    "",
    body,
    "",
    `Open it here: ${linkUrl}`,
    "",
    "---",
    `You get this email because you have an account on ${PRODUCT_NAME}.`,
    `Turn email notifications off any time: ${settingsUrl}`,
  ].join("\n");

  // Inline styles and tables, because email apps ignore most modern CSS.
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
        <tr><td style="background:#f59e0b;padding:18px 24px;font-size:16px;font-weight:700;color:#1c1917;">${escapeHtml(PRODUCT_NAME)}</td></tr>
        <tr><td style="padding:28px 24px 8px 24px;">
          ${projectName ? `<p style="margin:0 0 8px 0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#78716c;">${escapeHtml(projectName)}</p>` : ""}
          <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;color:#1c1917;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#44403c;">${escapeHtml(body)}</p>
          <a href="${escapeHtml(linkUrl)}" style="display:inline-block;background:#f59e0b;color:#1c1917;font-weight:700;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:10px;">Open in ${escapeHtml(PRODUCT_NAME)}</a>
        </td></tr>
        <tr><td style="padding:24px;font-size:12px;line-height:1.6;color:#78716c;">
          You get this email because you have an account on ${escapeHtml(PRODUCT_NAME)}.
          <a href="${escapeHtml(settingsUrl)}" style="color:#78716c;">Turn email notifications off</a> in your settings any time.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { to: input.to, subject: title, text, html };
}
