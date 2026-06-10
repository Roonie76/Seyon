export default function MarketplaceLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse px-4 py-8">
      <div className="mb-6 h-8 w-64 rounded-md bg-foreground/10" />
      <div className="mb-8 h-11 w-full max-w-xl rounded-md bg-foreground/10" />
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
