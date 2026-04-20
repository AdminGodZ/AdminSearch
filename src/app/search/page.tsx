import type { Metadata } from "next";
import { Suspense } from "react";

import { Footer } from "@/components/site/footer";
import { SearchPageClient } from "@/features/search/components/search-page-client";
import { SearchPageFallback } from "@/features/search/components/search-page-fallback";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Search",
};

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
