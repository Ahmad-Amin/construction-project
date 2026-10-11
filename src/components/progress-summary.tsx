import { ProgressBar } from "@/components/project-bits";
import type { Milestone } from "@/lib/types";

// The top of the Progress page: the overall number, how many milestones are done, and one bar
// segment per milestone so you can see where the work is, not only how much of it.
export function ProgressSummary({ milestones, percent }: { milestones: Pick<Milestone, "id" | "name" | "status" | "progress_percent">[]; percent: number }) {
  const doneCount = milestones.filter((m) => m.status === "done").length;
  const toGo = milestones.length - doneCount;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold tabular-nums sm:text-5xl">{percent}%</span>
          <h2 className="font-semibold text-muted">Overall progress</h2>
        </div>
        {milestones.length > 0 && (
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">
              {doneCount} of {milestones.length}
            </span>{" "}
            {milestones.length === 1 ? "milestone" : "milestones"} complete
            {toGo > 0 && ` · ${toGo} to go`}
          </p>
        )}
      </div>

      {milestones.length > 0 ? (
        // One segment per milestone, so you see where the work is, not only how much.
        <ol className="mt-4 flex gap-1.5" aria-label="Progress by milestone">
          {milestones.map((m) => (
            <li key={m.id} className="min-w-0 flex-1" title={`${m.name}: ${m.progress_percent}%`}>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${m.status === "done" ? "bg-success" : "bg-primary"}`}
                  style={{ width: `${m.progress_percent}%` }}
                />
              </div>
              <p className="mt-1.5 hidden truncate text-xs text-muted sm:block">{m.name}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4">
          <ProgressBar percent={percent} />
        </div>
      )}
      <p className="mt-3 text-xs text-muted">The average of all milestones below.</p>
    </section>
  );
}
