import { timingSafeEqual } from "node:crypto";

// Scheduled jobs prove who they are with "Authorization: Bearer <CRON_SECRET>". Without a secret
// set, every job refuses to run.
export function cronAuthorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
