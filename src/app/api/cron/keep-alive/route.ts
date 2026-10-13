import { NextResponse } from "next/server";
import { cronAuthorised } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Runs once a day. Supabase's free plan pauses a project after about a week with no activity, and
// a paused project means a broken app. This one tiny read counts as activity, so it never pauses.
// It reads nothing sensitive and returns nothing about the data.
export async function GET(request: Request) {
  if (!cronAuthorised(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { error } = await createAdminClient().from("companies").select("id", { head: true, count: "exact" }).limit(1);
  if (error) {
    console.error("[keep-alive] the database did not answer", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
