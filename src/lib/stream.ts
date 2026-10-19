import { createHmac, createSign, timingSafeEqual } from "node:crypto";

// Cloudflare Stream, where site videos live (server only: it holds the API token and the signing key).
//
// Settings (see the README):
//   VIDEO_UPLOADS=on                     adding videos is switched on (off: no video button; posted videos still play)
//   CLOUDFLARE_ACCOUNT_ID                the Cloudflare account
//   CLOUDFLARE_STREAM_API_TOKEN          an API token with Stream: Edit
//   CLOUDFLARE_STREAM_CUSTOMER_CODE      the "customer-…" part of the Stream address
//   CLOUDFLARE_STREAM_KEY_ID             the signing key, made by `npm run stream:setup`
//   CLOUDFLARE_STREAM_KEY_PEM            (as Cloudflare gives it: base64)
//   CLOUDFLARE_STREAM_WEBHOOK_SECRET     proves notifications come from Cloudflare (also made by stream:setup)
//
// Every video is uploaded as "signed links only": it plays only through a short-lived link made here, for someone
// allowed to see it.

export type StreamConfig = {
  accountId: string;
  apiToken: string;
  customerCode: string;
  keyId: string;
  keyPem: string;
  webhookSecret: string | null;
  apiBase: string;
  deliveryBase: string;
};

const env = (name: string) => (process.env[name] ?? "").trim();

let warned = false;

// The settings, or null when they are missing or don't look right (videos then can't be added or played).
export function streamConfig(): StreamConfig | null {
  const accountId = env("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = env("CLOUDFLARE_STREAM_API_TOKEN");
  const customerCode = env("CLOUDFLARE_STREAM_CUSTOMER_CODE").replace(/^customer-/, "").replace(/\.cloudflarestream\.com.*$/, "");
  const keyId = env("CLOUDFLARE_STREAM_KEY_ID");
  const keyB64 = env("CLOUDFLARE_STREAM_KEY_PEM");
  if (!accountId && !apiToken && !customerCode && !keyId && !keyB64) return null;

  let keyPem = "";
  try {
    keyPem = keyB64.includes("BEGIN") ? keyB64 : Buffer.from(keyB64, "base64").toString("utf8");
  } catch {
    keyPem = "";
  }
  const valid =
    /^[a-f0-9]{32}$/i.test(accountId) &&
    apiToken.length >= 20 &&
    /^[a-z0-9]{6,40}$/i.test(customerCode) &&
    /^[a-f0-9]{32}$/i.test(keyId) &&
    keyPem.includes("PRIVATE KEY");
  if (!valid) {
    if (!warned) {
      warned = true;
      console.error("[stream] The Cloudflare Stream settings are incomplete or don't look right; videos are off. See the README.");
    }
    return null;
  }
  return {
    accountId,
    apiToken,
    customerCode,
    keyId,
    keyPem,
    webhookSecret: env("CLOUDFLARE_STREAM_WEBHOOK_SECRET") || null,
    // Only the tests point these elsewhere.
    apiBase: env("CLOUDFLARE_API_BASE").replace(/\/+$/, "") || "https://api.cloudflare.com/client/v4",
    deliveryBase: env("CLOUDFLARE_STREAM_DELIVERY_BASE").replace(/\/+$/, "") || `https://customer-${customerCode}.cloudflarestream.com`,
  };
}

// Adding videos is switched on (and the settings are there).
export const videoUploadsOn = () => env("VIDEO_UPLOADS").toLowerCase() === "on" && streamConfig() !== null;

// ---------------------------------------------------------------------------
// Uploading
// ---------------------------------------------------------------------------

// tus "Upload-Metadata": key and base64 value pairs; a key on its own is a flag.
export function uploadMetadata(meta: Record<string, string | true>) {
  return Object.entries(meta)
    .map(([key, value]) => (value === true ? key : `${key} ${Buffer.from(value, "utf8").toString("base64")}`))
    .join(",");
}

export type DirectUpload = { uploadUrl: string; uid: string };

// A one-time upload link for the phone to send the file to, directly. Cloudflare refuses a video longer than
// maxSeconds, and the link stops working after six hours.
export async function createDirectUpload(
  cfg: StreamConfig,
  input: { size: number; maxSeconds: number; name: string; now?: number },
): Promise<DirectUpload> {
  const expiry = new Date((input.now ?? Date.now()) + 6 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const response = await fetch(`${cfg.apiBase}/accounts/${cfg.accountId}/stream?direct_user=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiToken}`,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(input.size),
      "Upload-Metadata": uploadMetadata({
        maxdurationseconds: String(input.maxSeconds),
        expiry,
        requiresignedurls: true,
        name: input.name,
      }),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const uploadUrl = response.headers.get("location") ?? "";
  const uid = response.headers.get("stream-media-id") ?? "";
  if (response.status !== 201 || !uploadUrl || !/^[A-Za-z0-9_-]{8,64}$/.test(uid)) {
    throw new Error(`Cloudflare didn't create the upload (${response.status}): ${(await response.text().catch(() => "")).slice(0, 200)}`);
  }
  if (!/^https:\/\//.test(uploadUrl) && !cfg.apiBase.startsWith("http://")) throw new Error("Cloudflare gave an unexpected upload address.");
  return { uploadUrl, uid };
}

// ---------------------------------------------------------------------------
// Watching
// ---------------------------------------------------------------------------
const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

// A signed token for one video (RS256, Cloudflare's format), valid for `seconds` (Cloudflare allows at most a day).
export function signVideoToken(cfg: StreamConfig, uid: string, seconds: number, now = Date.now()) {
  const nowSec = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", kid: cfg.keyId }));
  const payload = base64url(
    JSON.stringify({ sub: uid, kid: cfg.keyId, exp: nowSec + Math.min(seconds, 24 * 60 * 60), nbf: nowSec - 60 }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(cfg.keyPem).toString("base64url")}`;
}

// The player, in an iframe. It picks the quality to suit the connection.
export const playerUrl = (cfg: StreamConfig, token: string) =>
  `${cfg.deliveryBase}/${token}/iframe?autoplay=true&preload=auto&letterboxColor=transparent`;

// A still from the video, a second in (the first frame is often black).
export const thumbnailUrl = (cfg: StreamConfig, token: string, height = 360) =>
  `${cfg.deliveryBase}/${token}/thumbnails/thumbnail.jpg?time=1s&height=${height}`;

// ---------------------------------------------------------------------------
// Status and deletion
// ---------------------------------------------------------------------------
export type VideoState = { state: string; duration: number | null; errorCode: string };

// What Cloudflare says about a video now (null when it has no such video).
export async function fetchVideoState(cfg: StreamConfig, uid: string): Promise<VideoState | null> {
  const response = await fetch(`${cfg.apiBase}/accounts/${cfg.accountId}/stream/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${cfg.apiToken}` },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Cloudflare didn't answer (${response.status}).`);
  const body = (await response.json()) as { result?: { status?: { state?: string; errorReasonCode?: string }; duration?: number } };
  const r = body.result ?? {};
  return {
    state: String(r.status?.state ?? ""),
    duration: typeof r.duration === "number" && r.duration > 0 ? r.duration : null,
    errorCode: String(r.status?.errorReasonCode ?? ""),
  };
}

// Removes a video from Cloudflare. A video that is already gone counts as removed.
export async function deleteStreamVideo(cfg: StreamConfig, uid: string) {
  const response = await fetch(`${cfg.apiBase}/accounts/${cfg.accountId}/stream/${encodeURIComponent(uid)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${cfg.apiToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Cloudflare didn't delete it (${response.status}).`);
}

// ---------------------------------------------------------------------------
// Notifications from Cloudflare
// ---------------------------------------------------------------------------
// "Webhook-Signature: time=1230811200,sig1=<hex HMAC-SHA256 of `${time}.${body}`>". Older than `toleranceSeconds`
// is refused, so a captured notification can't be replayed later.
export function verifyWebhook(secret: string, header: string | null, body: string, now = Date.now(), toleranceSeconds = 600) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const time = Number(parts.time);
  const given = parts.sig1 ?? "";
  if (!Number.isFinite(time) || !/^[a-f0-9]{64}$/i.test(given)) return false;
  if (Math.abs(now / 1000 - time) > toleranceSeconds) return false;
  const wanted = createHmac("sha256", secret).update(`${parts.time}.${body}`).digest();
  const got = Buffer.from(given, "hex");
  return got.length === wanted.length && timingSafeEqual(got, wanted);
}
