export default function ProtectedLoading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-mist" />
          <div className="h-4 w-64 max-w-full rounded bg-mist/70" />
        </div>
        <div className="h-10 w-28 rounded-xl bg-mist" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl border border-mist bg-white" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-mist bg-white">
        <div className="h-11 border-b border-mist bg-foam" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-mist px-4 py-4 last:border-b-0">
            <div className="h-4 flex-1 rounded bg-mist/80" />
            <div className="h-4 w-24 rounded bg-mist/60" />
            <div className="h-4 w-16 rounded bg-mist/60" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
