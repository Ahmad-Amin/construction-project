import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { getOrigin } from "@/lib/origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderWeeklySummaryEmail, signSummaryPhotos, type WeeklySummary } from "@/lib/weekly-summary";

export const dynamic = "force-dynamic";
// Plenty of room to send a few hundred emails one after another.
export const maxDuration = 300;

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

// The weekly job. Point a scheduler at this every Sunday evening (see the README): it asks the
// database which homeowners are due a summary, emails each one, and reports back. Running it
// twice in the same week is harmless: the database remembers who already got theirs.
export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_weekly_summaries");
  if (error) {
    console.error("[weekly-summary] could not build the summaries", error);
    return NextResponse.json({ error: "Could not build the summaries." }, { status: 500 });
  }

  const rows = (data ?? []) as {
    out_notification_id: string;
    out_to_email: string;
    out_project_id: string;
    out_summary: WeeklySummary;
  }[];

  const origin = process.env.SITE_URL?.replace(/\/$/, "") || (await getOrigin());
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    let ok = false;
    let reason = "";
    try {
      const photoUrls = await signSummaryPhotos(admin, row.out_summary.photos);
      const result = await sendEmail(
        renderWeeklySummaryEmail({
          to: row.out_to_email,
          summary: row.out_summary,
          photoUrls,
          projectUrl: `${origin}/dashboard/projects/${row.out_project_id}`,
          settingsUrl: `${origin}/dashboard/settings`,
        }),
      );
      ok = result.ok;
      if (!result.ok) reason = result.error;
    } catch (err) {
      reason = err instanceof Error ? err.message : "Unknown error";
    }
    await admin.rpc("finish_summary_email", { p_id: row.out_notification_id, p_ok: ok, p_error: reason || null });
    if (ok) sent++;
    else {
      failed++;
      console.error(`[weekly-summary] ${row.out_project_id}: ${reason}`);
    }
  }

  return NextResponse.json({ due: rows.length, sent, failed });
}
