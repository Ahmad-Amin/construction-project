import { NextResponse } from "next/server";
import type { NotificationItem } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EPOCH = "1970-01-01T00:00:00Z";

// "Has anything new arrived for me?" The open dashboard asks this every so often, so it can pop up
// a toast. Without `since` it only reports where things stand now (the starting point); with it,
// it returns what arrived after that moment, oldest first. Row-level security means it can only
// ever be the signed-in person's own notifications.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({ error: "signed out" }, { status: 401 });

  const since = new URL(request.url).searchParams.get("since");

  if (!since) {
    const { data } = await supabase
      .from("notifications")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    return NextResponse.json({ latest: data?.[0]?.created_at ?? EPOCH, items: [] });
  }
  if (Number.isNaN(Date.parse(since))) return NextResponse.json({ error: "bad since" }, { status: 400 });

  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, created_at, read_at")
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5);

  const rows = data ?? [];
  const items: NotificationItem[] = rows.map((r) => ({
    id: r.id as string,
    kind: r.kind,
    title: r.title as string,
    body: r.body as string,
    link: r.link as string,
    createdAt: r.created_at as string,
    read: r.read_at !== null,
  }));
  return NextResponse.json({ latest: rows.length ? rows[rows.length - 1].created_at : since, items });
}
