import { toE164 } from "@/lib/phone";
import { PRODUCT_NAME } from "@/lib/site";
import templates from "@/lib/whatsapp-templates.json";

// Sending WhatsApp messages through Meta's WhatsApp Cloud API. This is separate from
// lib/whatsapp.ts, which only builds the click-to-chat links people tap themselves.
//
// WHATSAPP_MODE decides what happens:
//   off   (default) nothing is sent and the app hides the WhatsApp switch
//   log   messages are written to the server console instead of being sent (safe for testing)
//   live  messages go out through the Cloud API
// Also needed for live: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN.
// Optional: WHATSAPP_API_VERSION (default v23.0), WHATSAPP_TEMPLATE_LANGUAGE (default en_US).

export type WhatsAppMode = "off" | "log" | "live";

export function whatsappMode(): WhatsAppMode {
  const mode = (process.env.WHATSAPP_MODE ?? "").toLowerCase();
  return mode === "live" || mode === "log" ? mode : "off";
}

export const whatsappEnabled = () => whatsappMode() !== "off";

const language = () => process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";

// ---------------------------------------------------------------------------
// The message templates. WhatsApp only lets a business start a conversation with an approved
// template, so each message is one of these, with the {{numbers}} filled in. They are created
// in the account by `npm run whatsapp:templates`, which reads them from whatsapp-templates.json. If you change
// the wording, change the name too (for example payment_to_confirm_v2): approved templates
// cannot be edited.
// ---------------------------------------------------------------------------
export const WHATSAPP_TEMPLATES = templates;

export type TemplateName = keyof typeof templates;

// Template values can't hold line breaks, tabs or long runs of spaces.
const clean = (value: string, max = 300) => {
  const text = value.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

const firstName = (name: string) => clean(name.trim().split(/\s+/)[0] ?? "") || "there";

export type NotificationForWhatsApp = {
  kind: string;
  title: string;
  body: string;
  link: string;
  project_name: string | null;
  recipient_name: string;
};

// Which template a notification becomes, and what goes into its blanks. Only things the
// homeowner can already see are ever in these messages (it is built from their notification).
export function buildWhatsAppMessage(
  n: NotificationForWhatsApp,
  origin: string,
): { template: TemplateName; params: string[] } | null {
  const name = firstName(n.recipient_name);
  const project = clean(n.project_name ?? "your project", 100);
  const link = `${origin}${n.link}`;

  switch (n.kind) {
    case "payment_recorded": {
      const amount = n.title.match(/PKR [\d,]+/)?.[0] ?? "an amount";
      return { template: "payment_to_confirm", params: [name, amount, project, link] };
    }
    case "update_posted":
      return { template: "site_update_posted", params: [name, project, link] };
    case "milestone_completed": {
      const stage = clean(n.title.replace(/ is complete$/, ""), 100) || "A stage";
      return { template: "stage_status", params: [name, stage, project, link] };
    }
    case "project_completed":
      return { template: "project_complete", params: [name, project, link] };
    case "weekly_summary":
      return { template: "weekly_status", params: [name, project, clean(n.body, 200), link] };
    default:
      return null;
  }
}

export type WhatsAppResult = { ok: true } | { ok: false; error: string };

// Sends one approved template to one number.
export async function sendWhatsAppTemplate(
  phone: string,
  template: TemplateName,
  params: string[],
): Promise<WhatsAppResult> {
  const mode = whatsappMode();
  if (mode === "off") return { ok: false, error: "WhatsApp sending is switched off." };

  const e164 = toE164(phone);
  if (!e164) return { ok: false, error: "That phone number isn't valid." };
  const to = e164.slice(1);

  if (mode === "log") {
    console.log(`[whatsapp:log] ${PRODUCT_NAME} → +${to} · ${template} · ${JSON.stringify(params)}`);
    return { ok: true };
  }

  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!id || !token) return { ok: false, error: "WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN is not set." };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v23.0"}/${id}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: template,
            language: { code: language() },
            components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
          },
        }),
      },
    );
    if (response.ok) return { ok: true };
    const detail = (await response.json().catch(() => null)) as { error?: { message?: string; code?: number } } | null;
    const reason = detail?.error?.message ?? `HTTP ${response.status}`;
    return { ok: false, error: `WhatsApp ${detail?.error?.code ?? response.status}: ${reason}`.slice(0, 280) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach WhatsApp." };
  }
}
