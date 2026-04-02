import { Suspense } from "react";

import { Footer } from "@/components/footer";
import { SearchPageClient } from "@/components/search-page-client";

export const dynamic = "force-dynamic";

function SearchPageFallback() {
  return (
    <main className="mx-auto w-full flex-1 max-w-6xl px-6 py-8 sm:px-8 lg:px-10">
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
        {["fallback-1", "fallback-2", "fallback-3"].map((key) => (
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

export default function SearchPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Suspense fallback={<SearchPageFallback />}>
        <SearchPageClient />
      </Suspense>
      <Footer />
    </div>
  );
}
