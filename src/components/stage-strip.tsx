import Link from "next/link";
import { Check } from "lucide-react";
import { ProgressRing } from "@/components/viz";
import type { Milestone } from "@/lib/types";

// The build as a row of stages, each with its own progress ring. The tiles share the row's width,
// and the colour tells the story at a glance: green is finished, amber is where the work is now,
// grey hasn't started. With many stages the row scrolls sideways instead of squeezing.
export function StageStrip({ milestones, href }: { milestones: Milestone[]; href: string }) {
  if (milestones.length === 0) {
    return <p className="text-sm text-muted">No milestones yet.</p>;
  }

  return (
    <ol className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
      {milestones.map((m, i) => {
        const done = m.status === "done";
        const current = m.status === "in_progress";
        return (
          <li key={m.id} className="animate-rise min-w-36 flex-1 snap-start" style={{ animationDelay: `${i * 70}ms` }}>
            <Link
              href={href}
              className={`flex h-full flex-col items-center rounded-2xl border px-3 py-4 text-center transition-colors ${
                done
                  ? "border-success/30 bg-success-soft/40 hover:border-success/60 hover:bg-success-soft/70"
                  : current
                    ? "border-primary/50 bg-primary-soft/40 hover:border-primary hover:bg-primary-soft/70"
                    : "border-line bg-surface-2/50 hover:border-primary/60 hover:bg-surface-2"
              }`}
            >
              <ProgressRing
                percent={m.progress_percent}
                size={60}
                stroke={6}
                tone={done ? "success" : "accent"}
                label={`${m.name} complete`}
              >
                {done ? (
                  <Check className="size-6 text-success" aria-hidden />
                ) : (
                  <span className={`text-sm font-bold tabular-nums ${current ? "" : "text-muted"}`}>{m.progress_percent}%</span>
                )}
              </ProgressRing>
              <span className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold leading-snug">{m.name}</span>
              <span
                className={`mt-0.5 text-xs ${
                  done ? "font-medium text-success" : current ? "font-medium text-primary-hover" : "text-muted"
                }`}
              >
                {done ? "Done" : current ? "In progress" : "Not started"}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
