import { headers } from "next/headers";

// The address people use to reach this app, for building links they will open elsewhere
// (invites, WhatsApp messages). Works behind a proxy and on localhost.
export async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
