import Link from "next/link";
import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { TimelineFeed } from "@/components/timeline-feed";
import { getProjectBasic } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { fetchTimeline } from "@/lib/timeline";
import { button } from "@/lib/ui";

export const metadata = { title: "Timeline" };

const STEP = 30;
const MAX = 200;

export default async function TimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ n?: string }>;
}) {
  const { id } = await params;
  const project = await getProjectBasic(id);
  if (!project) notFound();

  const { n } = await searchParams;
  const limit = Math.min(Math.max(Number.parseInt(n ?? "", 10) || STEP, STEP), MAX);

  const supabase = await createClient();
  const { events, hasMore } = await fetchTimeline(supabase, id, limit);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <History className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 font-semibold">Nothing here yet</h2>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Site updates, shared expenses and payments will appear here as they happen, in one history.
        </p>
      </div>
    );
  }

  return (
    <div>
      <TimelineFeed events={events} />
      {hasMore && limit < MAX && (
        <div className="mt-8 text-center">
          <Link href={`?n=${limit + STEP}`} scroll={false} className={button("secondary", "sm")}>
            Show older
          </Link>
        </div>
      )}
      {hasMore && limit >= MAX && (
        <p className="mt-8 text-center text-sm text-muted">Showing the latest {MAX} events.</p>
      )}
    </div>
  );
}
