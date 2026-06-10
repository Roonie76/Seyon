export default function StoreLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-4 py-8">
      {/* Banner */}
      <div className="mb-6 h-48 w-full rounded-xl bg-foreground/10" />
      {/* Shop header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-foreground/10" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-foreground/10" />
          <div className="h-4 w-32 rounded bg-foreground/10" />
        </div>
      </div>
      {/* Products grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-foreground/10">
            <div className="aspect-square bg-foreground/10" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 rounded bg-foreground/10" />
              <div className="h-4 w-1/3 rounded bg-foreground/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
