export default function ProductLoading() {
  return (
    <div className="container mx-auto animate-pulse px-4 py-8">
      <div className="mb-8 h-5 w-40 rounded bg-foreground/10" />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <div className="aspect-video w-full rounded-xl bg-foreground/10" />
          <div className="h-40 rounded-xl border border-foreground/10 bg-foreground/5" />
        </div>
        <div className="space-y-6">
          <div className="space-y-4 rounded-xl border border-foreground/10 p-6">
            <div className="h-5 w-20 rounded-full bg-foreground/10" />
            <div className="h-7 w-4/5 rounded bg-foreground/10" />
            <div className="h-9 w-32 rounded bg-foreground/10" />
            <div className="h-12 w-full rounded-md bg-foreground/10" />
          </div>
          <div className="h-36 rounded-xl border border-foreground/10 bg-foreground/5" />
        </div>
      </div>
    </div>
  );
}
