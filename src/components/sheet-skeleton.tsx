import { Spinner } from "@/components/spinner";

// What the slide-over panel shows for the moment before its form has loaded.
export function SheetSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col pb-8">
      <h2 id="sheet-title" className="mb-5 flex items-center gap-3 text-xl font-bold tracking-tight">
        <Spinner className="size-5 text-muted" /> Loading…
      </h2>
      <div aria-hidden className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-surface-2" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
