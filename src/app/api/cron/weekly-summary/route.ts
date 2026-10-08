import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { getOrigin } from "@/lib/origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderWeeklySummaryEmail, signSummaryPhotos, type WeeklySummary } from "@/lib/weekly-summary";

export const dynamic = "force-dynamic";
// Vercel's limit on the free plan. Emails go out ten at a time, so this covers a few thousand.
export const maxDuration = 60;

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

  async function deliver(row: (typeof rows)[number]) {
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

  for (let i = 0; i < rows.length; i += 10) {
    await Promise.all(rows.slice(i, i + 10).map(deliver));
  }

  return NextResponse.json({ due: rows.length, sent, failed });
}
