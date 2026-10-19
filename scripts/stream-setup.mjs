#!/usr/bin/env node
// One-time setup for site videos (Cloudflare Stream). Run it after putting CLOUDFLARE_ACCOUNT_ID and
// CLOUDFLARE_STREAM_API_TOKEN into .env.local:
//
//   npm run stream:setup                                         checks the token, makes the signing key
//   npm run stream:setup -- --webhook https://your-site/api/webhooks/stream
//                                                                also tells Cloudflare where to report finished videos
//   npm run stream:setup -- --new-key                            replaces the signing key (old links stop working)
//
// What it makes is saved straight into .env.local and never printed. Copy the same values into Vercel afterwards.
import fs from "node:fs";

const FILE = ".env.local";
const args = process.argv.slice(2);
const webhookAt = args.indexOf("--webhook");
const webhook = webhookAt >= 0 ? args[webhookAt + 1] : null;
const newKey = args.includes("--new-key");

const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

if (!fs.existsSync(FILE)) fail(`${FILE} not found. Run this from the project folder.`);
let text = fs.readFileSync(FILE, "utf8");
const read = (key) => {
  const m = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim().replace(/^(["'])(.*)\1$/, "$2") : "";
};
const save = (key, value) => {
  const line = `${key}=${value}`;
  text = new RegExp(`^${key}=.*$`, "m").test(text) ? text.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${text.replace(/\n*$/, "\n")}${line}\n`;
  fs.writeFileSync(FILE, text);
};

const account = read("CLOUDFLARE_ACCOUNT_ID");
const token = read("CLOUDFLARE_STREAM_API_TOKEN");
if (!/^[a-f0-9]{32}$/i.test(account)) fail("CLOUDFLARE_ACCOUNT_ID is missing from .env.local (or isn't the 32-character account ID).");
if (token.length < 20) fail("CLOUDFLARE_STREAM_API_TOKEN is missing from .env.local.");
if (webhook && !/^https:\/\/[^\s]+\/api\/webhooks\/stream$/.test(webhook)) {
  fail("The webhook address should look like https://your-site/api/webhooks/stream (https, your live site).");
}

const api = async (method, path, body) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/stream${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.success === false) {
    const why = json.errors?.map((e) => e.message).join("; ") || `HTTP ${response.status}`;
    fail(`Cloudflare said no (${method} ${path || "/"}): ${why}. Check the token has "Stream: Edit" for this account, and that Stream is subscribed.`);
  }
  return json.result;
};

// 1. The token works, and Stream is on.
const videos = await api("GET", "?limit=1");
console.log("✓ The API token works and Stream is on.");

// 2. The signing key (private playback links).
if (read("CLOUDFLARE_STREAM_KEY_ID") && read("CLOUDFLARE_STREAM_KEY_PEM") && !newKey) {
  console.log("✓ A signing key is already in .env.local (use --new-key to replace it).");
} else {
  const key = await api("POST", "/keys");
  save("CLOUDFLARE_STREAM_KEY_ID", key.id);
  save("CLOUDFLARE_STREAM_KEY_PEM", key.pem);
  console.log("✓ Made a signing key and saved it to .env.local.");
}

// 3. Where Cloudflare reports finished videos.
if (webhook) {
  const hook = await api("PUT", "/webhook", { notificationUrl: webhook });
  if (!hook?.secret) fail("Cloudflare didn't return the webhook secret.");
  save("CLOUDFLARE_STREAM_WEBHOOK_SECRET", hook.secret);
  console.log(`✓ Cloudflare will report finished videos to ${webhook}; its secret is saved to .env.local.`);
} else if (!read("CLOUDFLARE_STREAM_WEBHOOK_SECRET")) {
  console.log("• No webhook yet. On your live site, run again with --webhook https://<your site>/api/webhooks/stream");
}

// 4. The customer code, if a video already shows it.
const preview = Array.isArray(videos) ? videos.find((v) => typeof v.preview === "string")?.preview : null;
const code = preview?.match(/customer-([a-z0-9]+)\.cloudflarestream\.com/)?.[1];
if (code && !read("CLOUDFLARE_STREAM_CUSTOMER_CODE")) {
  save("CLOUDFLARE_STREAM_CUSTOMER_CODE", code);
  console.log("✓ Saved your Stream customer code.");
} else if (!read("CLOUDFLARE_STREAM_CUSTOMER_CODE")) {
  console.log(
    "• Add CLOUDFLARE_STREAM_CUSTOMER_CODE to .env.local: in the Cloudflare dashboard, open Stream; the code is the\n" +
      "  part after customer- in any video link (customer-<code>.cloudflarestream.com).",
  );
}

console.log("\nNext: set VIDEO_UPLOADS=on, and copy the CLOUDFLARE_* values and VIDEO_UPLOADS into Vercel (Settings → Environment Variables).\n");
