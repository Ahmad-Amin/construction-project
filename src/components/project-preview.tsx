import { Camera, MapPin } from "lucide-react";

const milestones = [
  { name: "Grey Structure", percent: 85 },
  { name: "Electrical", percent: 40 },
  { name: "Plumbing", percent: 35 },
];

// Illustrative sample of what a homeowner sees. Not live data.
export function ProjectPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl shadow-black/5"
      aria-label="Sample homeowner project view"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold leading-tight">Ahmed Residence</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" aria-hidden /> DHA Lahore
          </p>
        </div>
        <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
          Active
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Overall progress</span>
          <span className="text-2xl font-bold">53%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-[53%] rounded-full bg-primary" />
        </div>
      </div>

      {!compact && (
      <ul className="mt-5 space-y-3">
        {milestones.map((m) => (
          <li key={m.name}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{m.name}</span>
              <span className="text-muted">{m.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-foreground/70"
                style={{ width: `${m.percent}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Received</p>
          <p className="mt-0.5 font-bold">PKR 17.5M</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">Spent</p>
          <p className="mt-0.5 font-bold">PKR 12.4M</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-line p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Camera className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Roof slab cast, 3 photos</p>
          <p className="text-xs text-muted">Latest update · 2 days ago</p>
        </div>
      </div>
    </div>
  );
}
