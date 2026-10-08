import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, type Email } from "@/lib/email";
import { formatDate, formatPKR } from "@/lib/format";
import { PRODUCT_NAME } from "@/lib/site";

// What the database hands over for one project's week: only things the homeowner can already
// see (see build_weekly_summary in the migration). Nothing about expenses is in here.
export type WeeklySummary = {
  project_id: string;
  project_name: string;
  company_name: string;
  company_logo: string | null;
  client_name: string;
  progress: number;
  stages: { name: string; percent: number }[];
  finished: string[];
  update_count: number;
  updates: { date: string; text: string; author: string }[];
  photo_count: number;
  photos: string[];
  paid_count: number;
  paid_this_week: { amount: number; date: string }[];
  paid_this_week_total: number;
  paid_total: number;
  awaiting_count: number;
  awaiting_total: number;
  budget: number | null;
  has_activity: boolean;
};

// Photo links in an email have to outlive the day it was sent, so these last a week. They are
// the one place a photo link is longer-lived than the usual hour (the Private by design page
// says so).
const PHOTO_LINK_SECONDS = 7 * 24 * 60 * 60;

// Signed links for the week's photos. Whoever calls this must be allowed to read the files:
// the owner for a preview, the scheduled job for the real thing.
export async function signSummaryPhotos(supabase: SupabaseClient, paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data } = await supabase.storage.from("project-media").createSignedUrls(paths, PHOTO_LINK_SECONDS);
  return (data ?? []).flatMap((entry) => (entry.signedUrl ? [entry.signedUrl] : []));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function weeklySummarySubject(s: WeeklySummary) {
  return `${s.project_name}: your weekly update (${s.progress}% complete)`;
}

// Inline styles and tables, because email apps ignore most modern CSS.
export function renderWeeklySummaryEmail(input: {
  to: string;
  summary: WeeklySummary;
  photoUrls: string[];
  projectUrl: string;
  settingsUrl: string;
  preview?: boolean;
}): Email {
  const { summary: s, photoUrls, projectUrl, settingsUrl, preview } = input;
  const e = escapeHtml;
  const firstName = s.client_name.trim().split(/\s+/)[0] || "there";

  // ----- plain text -----
  const text: string[] = [
    ...(preview ? ["[PREVIEW: this is what your client receives on Sunday.]", ""] : []),
    `Hello ${firstName},`,
    `Here is your week on ${s.project_name} from ${s.company_name}.`,
    "",
    `Overall progress: ${s.progress}%`,
    ...s.stages.map((st) => `  - ${st.name}: ${st.percent}%`),
  ];
  if (s.finished.length) text.push("", `Finished this week: ${s.finished.join(", ")}`);
  if (s.update_count) {
    text.push("", `${plural(s.update_count, "site update", "site updates")}${s.photo_count ? `, ${plural(s.photo_count, "photo", "photos")}` : ""}:`);
    for (const u of s.updates) text.push(`  - ${formatDate(u.date)}: ${u.text}`);
  }
  if (s.paid_count || s.awaiting_count || s.paid_total) {
    text.push("", "Payments:");
    for (const p of s.paid_this_week) text.push(`  - ${formatPKR(p.amount)} confirmed (${formatDate(p.date)})`);
    if (s.paid_total) text.push(`  Confirmed so far: ${formatPKR(s.paid_total)}${s.budget ? ` of ${formatPKR(s.budget)} budget` : ""}`);
    if (s.awaiting_count) {
      text.push(`  Waiting for your confirmation: ${plural(s.awaiting_count, "payment", "payments")} (${formatPKR(s.awaiting_total)})`);
    }
  }
  text.push(
    "",
    `Open the project: ${projectUrl}`,
    "",
    "---",
    `Sent by ${PRODUCT_NAME} on behalf of ${s.company_name}, every Sunday while your project is active.`,
    `Turn weekly summaries off: ${settingsUrl}`,
  );

  // ----- html -----
  const card = (title: string, inner: string) => `
        <tr><td style="padding:0 24px 20px 24px;">
          <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#78716c;font-weight:700;">${e(title)}</p>
          ${inner}
        </td></tr>`;

  const bar = (percent: number, height: number, color: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;border-radius:${height}px;"><tr>` +
    `<td width="${Math.max(percent, 0)}%" style="background:${color};height:${height}px;border-radius:${height}px;font-size:0;line-height:0;">&nbsp;</td>` +
    `<td style="font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

  const stages = s.stages
    .map(
      (st) => `<tr><td style="padding:5px 0;font-size:14px;color:#44403c;">${e(st.name)}</td><td align="right" style="padding:5px 0;font-size:14px;color:#78716c;white-space:nowrap;">${st.percent}%</td></tr>
          <tr><td colspan="2" style="padding:0 0 6px 0;">${bar(st.percent, 6, "#44403c")}</td></tr>`,
    )
    .join("");

  const progress = card(
    "Progress",
    `<p style="margin:0 0 8px 0;font-size:30px;font-weight:700;color:#1c1917;">${s.progress}%<span style="font-size:14px;font-weight:400;color:#78716c;"> complete</span></p>
          ${bar(s.progress, 10, "#f59e0b")}
          ${s.finished.length ? `<p style="margin:14px 0 0 0;font-size:14px;color:#166534;background:#dcfce7;border-radius:8px;padding:8px 12px;">Finished this week: <strong>${s.finished.map(e).join(", ")}</strong></p>` : ""}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${stages}</table>`,
  );

  const updates = s.update_count
    ? card(
        `${plural(s.update_count, "site update", "site updates")}${s.photo_count ? ` · ${plural(s.photo_count, "photo", "photos")}` : ""}`,
        s.updates
          .map(
            (u) => `<p style="margin:0 0 10px 0;font-size:14px;line-height:1.55;color:#44403c;"><span style="color:#78716c;">${e(formatDate(u.date))}</span><br>${e(u.text)}</p>`,
          )
          .join("") +
          (photoUrls.length
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr>${photoUrls
                .slice(0, 4)
                .map(
                  (url) =>
                    `<td width="25%" style="padding:0 3px;"><a href="${e(projectUrl)}"><img src="${e(url)}" alt="Site photo" width="100%" style="display:block;width:100%;height:auto;border-radius:8px;border:0;"></a></td>`,
                )
                .join("")}</tr></table>`
            : ""),
      )
    : "";

  const hasMoney = s.paid_count > 0 || s.awaiting_count > 0 || s.paid_total > 0;
  const money = hasMoney
    ? card(
        "Payments",
        s.paid_this_week
          .map(
            (p) => `<p style="margin:0 0 6px 0;font-size:14px;color:#44403c;">${e(formatPKR(p.amount))} <span style="color:#166534;">confirmed</span> <span style="color:#78716c;">· ${e(formatDate(p.date))}</span></p>`,
          )
          .join("") +
          (s.paid_total
            ? `<p style="margin:8px 0 0 0;font-size:14px;color:#78716c;">Confirmed so far: <strong style="color:#1c1917;">${e(formatPKR(s.paid_total))}</strong>${s.budget ? ` of ${e(formatPKR(s.budget))}` : ""}</p>`
            : "") +
          (s.awaiting_count
            ? `<p style="margin:12px 0 0 0;font-size:14px;color:#92400e;background:#fef3c7;border-radius:8px;padding:8px 12px;"><strong>${e(plural(s.awaiting_count, "payment", "payments"))}</strong> (${e(formatPKR(s.awaiting_total))}) waiting for your confirmation.</p>`
            : ""),
      )
    : "";

  const html = `<!doctype html>
<html lang="en"><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
        ${preview ? `<tr><td style="background:#1c1917;color:#fafaf9;padding:8px 24px;font-size:12px;text-align:center;">Preview: this is what your client receives every Sunday</td></tr>` : ""}
        <tr><td style="background:#f59e0b;padding:18px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            ${s.company_logo ? `<td style="padding-right:12px;"><img src="${e(s.company_logo)}" alt="" width="36" height="36" style="display:block;width:36px;height:36px;border-radius:8px;background:#ffffff;object-fit:contain;"></td>` : ""}
            <td style="font-size:16px;font-weight:700;color:#1c1917;">${e(s.company_name)}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:24px 24px 18px 24px;">
          <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#78716c;">Your weekly update</p>
          <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;">${e(s.project_name)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#44403c;">Hello ${e(firstName)}, here is what happened on your project this week.</p>
        </td></tr>
        ${progress}
        ${updates}
        ${money}
        <tr><td style="padding:4px 24px 28px 24px;">
          <a href="${e(projectUrl)}" style="display:inline-block;background:#f59e0b;color:#1c1917;font-weight:700;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:10px;">Open your project</a>
        </td></tr>
        <tr><td style="padding:0 24px 24px 24px;font-size:12px;line-height:1.6;color:#78716c;">
          Sent by ${e(PRODUCT_NAME)} on behalf of ${e(s.company_name)}, every Sunday while your project is active.
          <a href="${e(settingsUrl)}" style="color:#78716c;">Turn weekly summaries off</a> in your settings any time.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return {
    to: input.to,
    subject: `${preview ? "[Preview] " : ""}${weeklySummarySubject(s)}`,
    text: text.join("\n"),
    html,
  };
}
