export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-4 py-8">
      <div className="mb-8 h-8 w-56 rounded-md bg-foreground/10" />
      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg border border-foreground/10 bg-foreground/5" />
        ))}
      </div>
      {/* Chart + table */}
      <div className="mb-8 h-64 rounded-lg border border-foreground/10 bg-foreground/5" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-md bg-foreground/10" />
        ))}
      </div>
    </div>
  );
}
