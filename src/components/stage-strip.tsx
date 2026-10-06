import Link from "next/link";
import { Check } from "lucide-react";
import { ProgressRing } from "@/components/viz";
import type { Milestone } from "@/lib/types";

// The build as a row of stages, each with its own small progress ring.
export function StageStrip({ milestones, href }: { milestones: Milestone[]; href: string }) {
  if (milestones.length === 0) {
    return <p className="text-sm text-muted">No milestones yet.</p>;
  }

  return (
    <ol className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
      {milestones.map((m, i) => (
        <li key={m.id} className="animate-rise snap-start" style={{ animationDelay: `${i * 70}ms` }}>
          <Link
            href={href}
            className="flex w-36 flex-col items-center rounded-2xl border border-line bg-surface-2/50 px-3 py-4 text-center transition-colors hover:border-primary/60 hover:bg-surface-2"
          >
            <ProgressRing percent={m.progress_percent} size={60} stroke={6} label={`${m.name} complete`}>
              {m.status === "done" ? (
                <Check className="size-6 text-success" aria-hidden />
              ) : (
                <span className="text-sm font-bold tabular-nums">{m.progress_percent}%</span>
              )}
            </ProgressRing>
            <span className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-snug">{m.name}</span>
            <span className="mt-0.5 text-xs text-muted">
              {m.status === "done" ? "Done" : m.status === "in_progress" ? "In progress" : "Not started"}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
