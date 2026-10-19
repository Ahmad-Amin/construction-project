import { NextResponse } from "next/server";
import { cronAuthorised } from "@/lib/cron-auth";
import { getOrigin } from "@/lib/origin";
import { sendSignupReminders } from "@/lib/signup-reminders";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanUpVideos } from "@/lib/videos";

export const dynamic = "force-dynamic";
// Reminder emails go out a few at a time; this leaves plenty of room for a day's worth.
export const maxDuration = 60;

// The daily job (06:00 UTC, see vercel.json). Three things:
//   1. Supabase's free plan pauses a project after about a week with no activity, and a paused project means a broken
//      app. This tiny read counts as activity, so it never pauses. It reads nothing sensitive.
//   2. People who signed up a day or more ago but haven't confirmed their email get one reminder (lib/signup-reminders.ts).
//   3. Site videos: ones never posted are dropped (and their minutes come back), deleted ones are removed from
//      Cloudflare (lib/videos.ts).
// It reports counts only, never who.
export async function GET(request: Request) {
  if (!cronAuthorised(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from("companies").select("id", { head: true, count: "exact" }).limit(1);
  if (error) {
    console.error("[keep-alive] the database did not answer", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // A problem with the reminders never fails the keep-alive.
  let reminders: { sent: number; failed: number; error?: string };
  try {
    reminders = await sendSignupReminders(admin, process.env.SITE_URL?.replace(/\/$/, "") || (await getOrigin()));
    if (reminders.error) console.error("[signup-reminders] could not find who is due", reminders.error);
  } catch (err) {
    console.error("[signup-reminders] the run failed", err);
    reminders = { sent: 0, failed: 0, error: "The run failed." };
  }

  // Nor does a problem with the videos.
  let videos: Awaited<ReturnType<typeof cleanUpVideos>> | null = null;
  try {
    videos = await cleanUpVideos(admin);
  } catch (err) {
    console.error("[videos] the daily clean-up failed", err);
  }

  return NextResponse.json({ ok: true, reminders: { sent: reminders.sent, failed: reminders.failed, ok: !reminders.error }, videos });
}
