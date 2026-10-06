// Shown instantly while a dashboard page loads, so slow mobile connections never see a blank screen.
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8" aria-busy="true" aria-label="Loading">
      <div className="h-40 animate-pulse rounded-3xl bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-2xl border border-line bg-surface" />
        ))}
      </div>
    </main>
  );
}
