export default function CategoryLoading() {
  return (
    <div className="container mx-auto animate-pulse px-4 py-8">
      <div className="mb-6 h-5 w-44 rounded bg-foreground/10" />
      <div className="mb-12 h-40 w-full rounded-2xl bg-foreground/10" />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-foreground/10">
            <div className="aspect-video bg-foreground/10" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded bg-foreground/10" />
              <div className="h-4 w-1/3 rounded bg-foreground/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
