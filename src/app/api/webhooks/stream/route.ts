import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/stream";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Cloudflare Stream calls this when a video has finished processing (ready) or couldn't be (error). We record it, with
// the video's real length. Needs CLOUDFLARE_STREAM_WEBHOOK_SECRET (made by `npm run stream:setup`); without it, or
// with a wrong signature, nothing is accepted. If a notification never arrives, the page asks Cloudflare itself.
export async function POST(request: Request) {
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim();
  const raw = await request.text();
  if (!secret || raw.length > 100_000 || !verifyWebhook(secret, request.headers.get("webhook-signature"), raw)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { uid?: unknown; duration?: unknown; status?: { state?: unknown; errorReasonCode?: unknown } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const uid = typeof payload.uid === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(payload.uid) ? payload.uid : null;
  const state = typeof payload.status?.state === "string" ? payload.status.state : "";
  if (!uid || !state) return NextResponse.json({ ok: true });

  const duration = typeof payload.duration === "number" && payload.duration > 0 ? payload.duration : null;
  const errorCode = typeof payload.status?.errorReasonCode === "string" ? payload.status.errorReasonCode : "";
  const { error } = await createAdminClient().rpc("video_set_status", { p_uid: uid, p_state: state, p_duration: duration, p_error: errorCode });
  if (error) {
    // Cloudflare tries again later; the page also checks by itself.
    console.error("[stream-webhook] couldn't record a video's status", error.message);
    return NextResponse.json({ error: "Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
