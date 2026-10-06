// Shown instantly while a dashboard page loads, so slow mobile connections never see a blank screen.
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:py-8" aria-busy="true" aria-label="Loading">
      <div className="h-40 animate-pulse rounded-3xl bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl border border-line bg-surface" />
        ))}
      </div>
    </main>
  );
}
