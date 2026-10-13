import { after, NextResponse } from "next/server";
import { getOrigin } from "@/lib/origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText, whatsappEnabled } from "@/lib/whatsapp-api";
import { autoReplyText, inboundSenders, validSignature } from "@/lib/whatsapp-webhook";

export const dynamic = "force-dynamic";

// Meta calls this when something happens on our WhatsApp number. We only use it for one thing:
// BuildPeek sends updates and does not read replies, so when someone writes to the number we answer
// once (at most once a day per person) to say so. Nothing they write is stored or looked at.
//
// Needs WHATSAPP_VERIFY_TOKEN (any long random string you choose, entered in Meta's webhook setup)
// and WHATSAPP_APP_SECRET (the app secret from the Meta app's Basic settings).

// Meta checks the address once, when you save it in the app's webhook settings.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Forbidden." }, { status: 403 });
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const raw = await request.text();
  if (!secret || !validSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const wantedNumber = process.env.WHATSAPP_PHONE_NUMBER_ID || undefined;
  const senders = inboundSenders(payload, wantedNumber);
  // These lines say why nothing was sent; they never include a phone number or message text.
  if (senders.length === 0) {
    const anyMessages = inboundSenders(payload).length > 0;
    console.info(
      anyMessages
        ? "[whatsapp-webhook] a message arrived for a different number than WHATSAPP_PHONE_NUMBER_ID, so it was ignored"
        : "[whatsapp-webhook] event received, no incoming message in it (delivery or read update)",
    );
    return NextResponse.json({ ok: true });
  }
  if (!whatsappEnabled()) {
    console.info("[whatsapp-webhook] message received, but WHATSAPP_MODE is off, so no reply was sent");
    return NextResponse.json({ ok: true });
  }

  const reply = autoReplyText(`${await getOrigin()}/dashboard/settings`);

  // Answer Meta straight away (it retries anything slow), and send the replies afterwards.
  after(async () => {
    const admin = createAdminClient();
    for (const phone of senders) {
      try {
        const { data: claimed, error } = await admin.rpc("claim_whatsapp_autoreply", { p_phone: phone });
        if (error) {
          console.error("[whatsapp-webhook] could not check the reply log:", error.message);
          continue;
        }
        if (!claimed) {
          console.info("[whatsapp-webhook] this person was already answered in the last 24 hours");
          continue;
        }
        const result = await sendWhatsAppText(phone, reply);
        if (result.ok) {
          console.info("[whatsapp-webhook] reply sent");
        } else {
          console.error("[whatsapp-webhook] the reply was not sent:", result.error);
          // Give the day's reply back, so their next message gets another try.
          await admin.rpc("release_whatsapp_autoreply", { p_phone: phone });
        }
      } catch (error) {
        console.error("[whatsapp-webhook] failed", error);
      }
    }
  });

  return NextResponse.json({ ok: true });
}
