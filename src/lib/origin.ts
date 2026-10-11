import { headers } from "next/headers";

// The address people use to reach this app, for building links they will open elsewhere
// (invites, emails, WhatsApp messages).
//
// In production set SITE_URL (for example https://app.example.com). Then every link is built from
// that fixed address and never from request headers, so a forged Host header can't make us send
// someone a link to another site. Without it (local development) the address comes from the
// request, which works behind a proxy and on localhost.
export async function getOrigin() {
  const fixed = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (fixed && /^https?:\/\/[^\s/]+$/.test(fixed)) return fixed;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  // Only a plain host name (and port) is accepted from a header.
  const safeHost = /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host) ? host : "localhost:3000";
  const proto = h.get("x-forwarded-proto") === "http" || safeHost.startsWith("localhost") ? "http" : "https";
  return `${proto}://${safeHost}`;
}
