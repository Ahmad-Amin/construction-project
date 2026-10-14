"use server";

import { escapeHtml, sendEmail } from "@/lib/email";
import { notifyPlatformAdmins } from "@/lib/admin-notify";
import { adminInbox } from "@/lib/inbox";
import { getOrigin } from "@/lib/origin";
import { PLANS, isPlanId } from "@/lib/plans";
import { PRODUCT_NAME } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export type RequestResult = { ok: boolean; message: string };


// The owner asks for Pro or Business. The request is written down first (which also enforces
// one request an hour), then we are emailed, and the owner gets a confirmation. If we can't be
// emailed, the request is taken back so they can simply try again.
export async function requestPlanUpgrade(plan: string, yearly: boolean): Promise<RequestResult> {
  if (!isPlanId(plan) || plan === "free") return { ok: false, message: "Please choose Pro or Business." };

  const viewer = await getViewer();
  if (viewer?.company?.role !== "owner") return { ok: false, message: "Only the company owner can ask for a plan." };

  const to = adminInbox("plan");
  if (!to) return { ok: false, message: "We can't take requests here right now. Please write to us directly." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_plan_upgrade", { p_plan: plan, p_yearly: yearly });
  if (error) {
    return { ok: false, message: error.code === "P0001" ? error.message : "We couldn't send your request. Please try again." };
  }
  const result = data as { result: "ok" | "too_soon"; minutes?: number; id?: string; company_id?: string; company_name?: string; current_plan?: string };
  if (result.result === "too_soon") {
    const wait = (result.minutes ?? 60) <= 1 ? "a minute" : `${result.minutes} minutes`;
    return { ok: true, message: `We already have your request and will write to you soon. You can send another in about ${wait}.` };
  }

  const info = PLANS[plan];
  const price = yearly ? `$${info.yearlyUsd} a year` : `$${info.monthlyUsd} a month`;
  const billing = yearly ? "yearly" : "monthly";
  const ownerName = viewer.name || viewer.email;
  const adminUrl = `${await getOrigin()}/dashboard/admin`;

  const lines = [
    `${viewer.company.name} wants the ${info.name} plan, billed ${billing} (${price}).`,
    "",
    `Company: ${result.company_name} (${result.company_id})`,
    `Owner: ${ownerName} <${viewer.email}>`,
    `Current plan: ${result.current_plan}`,
    "",
    "Reply to this email to send them the payment details. Once they have paid, set the plan here:",
    adminUrl,
  ];
  const e = escapeHtml;
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
      <tr><td style="background:#f59e0b;padding:18px 24px;font-size:16px;font-weight:700;color:#1c1917;">${e(PRODUCT_NAME)}: plan request</td></tr>
      <tr><td style="padding:28px 24px;">
        <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;">${e(viewer.company.name)} wants ${e(info.name)}</h1>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#44403c;">Billed ${e(billing)}, ${e(price)}.</p>
        <p style="margin:0 0 6px 0;font-size:14px;color:#44403c;"><strong>Company:</strong> ${e(result.company_name ?? "")}<br><span style="color:#78716c;font-size:12px;">${e(result.company_id ?? "")}</span></p>
        <p style="margin:0 0 6px 0;font-size:14px;color:#44403c;"><strong>Owner:</strong> ${e(ownerName)} &lt;${e(viewer.email)}&gt;</p>
        <p style="margin:0 0 20px 0;font-size:14px;color:#44403c;"><strong>Current plan:</strong> ${e(result.current_plan ?? "")}</p>
        <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#44403c;">Reply to this email to send them the payment details. Once they have paid, set the plan:</p>
        <a href="${e(adminUrl)}" style="display:inline-block;background:#f59e0b;color:#1c1917;font-weight:700;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:10px;">Open the plans page</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const sent = await sendEmail({
    to,
    subject: `Plan request: ${viewer.company.name} wants ${info.name} (${billing})`,
    text: lines.join("\n"),
    html,
    replyTo: viewer.email,
  });
  if (!sent.ok) {
    console.error("[plan-request] could not email the request:", sent.error);
    if (result.id) await supabase.rpc("cancel_plan_request", { p_id: result.id });
    return { ok: false, message: "We couldn't send your request. Please try again in a moment." };
  }

  // A short confirmation for the owner. If this one fails, the request itself still went through.
  const confirmText = [
    `Hello ${viewer.name || "there"},`,
    "",
    `We got your request for the ${info.name} plan (${billing}, ${price}) for ${viewer.company.name}.`,
    "We'll write to you today with the payment details. Your account changes as soon as the payment arrives.",
    "",
    "You can reply to this email with any questions.",
  ];
  const confirmHtml = `<!doctype html><html lang="en"><body style="margin:0;background:#f5f5f4;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
      <tr><td style="background:#f59e0b;padding:18px 24px;font-size:16px;font-weight:700;color:#1c1917;">${e(PRODUCT_NAME)}</td></tr>
      <tr><td style="padding:28px 24px;">
        <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;">We got your request</h1>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#44403c;">You asked for the <strong>${e(info.name)}</strong> plan (${e(billing)}, ${e(price)}) for ${e(viewer.company.name)}.</p>
        <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#44403c;">We'll write to you today with the payment details. Your account changes as soon as the payment arrives.</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#78716c;">You can reply to this email with any questions.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  await sendEmail({ to: viewer.email, subject: `We got your ${info.name} plan request`, text: confirmText.join("\n"), html: confirmHtml, replyTo: to });

  // The bell, for the people running the service. After everything above, and never in the way of it.
  await notifyPlatformAdmins({
    kind: "plan_requested",
    title: `${viewer.company.name} wants ${info.name} (${billing})`,
    body: `${ownerName} asked for the ${info.name} plan, ${price}.`,
    link: "/dashboard/admin",
    actorId: viewer.userId,
  });

  return { ok: true, message: "Request sent. We'll write to you today with the payment details." };
}
