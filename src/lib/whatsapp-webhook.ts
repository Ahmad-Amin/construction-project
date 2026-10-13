import { createHmac, timingSafeEqual } from "node:crypto";

// The pieces of Meta's WhatsApp webhook that don't need the database or the network, kept apart so
// they can be tested on their own. (No imports from the app here on purpose.)

// Meta signs every webhook body with the app secret: "sha256=" + HMAC-SHA256(body). A request
// without a matching signature did not come from Meta and is refused.
export function validSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const wanted = Buffer.from(`sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`);
  const given = Buffer.from(header);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

type Webhook = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: { from?: string; type?: string }[];
      };
    }[];
  }[];
};

// The people who wrote to our number in this webhook, once each, as plain digits. Delivery and read
// receipts ("statuses") are not messages and are ignored, and so are emoji reactions. When
// `phoneNumberId` is given, messages sent to any other number on the same app (such as the test
// number) are ignored too.
export function inboundSenders(payload: unknown, phoneNumberId?: string): string[] {
  const senders = new Set<string>();
  for (const entry of (payload as Webhook)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;
      if (phoneNumberId && value.metadata?.phone_number_id !== phoneNumberId) continue;
      for (const message of value.messages) {
        if (message.type === "reaction") continue;
        if (typeof message.from === "string" && /^[0-9]{6,20}$/.test(message.from)) senders.add(message.from);
      }
    }
  }
  return [...senders];
}

export function autoReplyText(settingsUrl: string): string {
  return (
    "Thanks for your message. This number only sends project updates and can't receive or read messages, " +
    "so please contact your contractor directly. " +
    `To stop these updates, turn off WhatsApp in your settings: ${settingsUrl}`
  );
}
