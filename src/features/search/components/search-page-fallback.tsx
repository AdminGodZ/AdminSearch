const fallbackKeys = ["fallback-1", "fallback-2", "fallback-3"];

export function SearchPageFallback() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 bg-background px-6 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 h-6 w-40 animate-pulse rounded-full bg-muted" />
      <div className="rounded-[28px] border border-border/80 bg-card/85 p-5 shadow-sm shadow-black/5">
        <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="h-10 w-48 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-44 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-44 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <div className="mt-6 space-y-4">
        {fallbackKeys.map((key) => (
          <div
            key={key}
            className="space-y-4 rounded-[28px] border border-border/80 bg-card/80 p-6 shadow-sm shadow-black/5"
          >
            <div className="h-3 w-1/4 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-2/3 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </main>
  );
}
