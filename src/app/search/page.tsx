import type { Metadata } from "next";
import { Suspense } from "react";

import { Footer } from "@/components/site/footer";
import { SearchPageClient } from "@/features/search/components/search-page-client";
import { SearchPageFallback } from "@/features/search/components/search-page-fallback";
import { getPersistedPreferences } from "@/features/settings/server/preferences";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Search",
};

export default async function SearchPage() {
  const preferences = await getPersistedPreferences();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Suspense fallback={<SearchPageFallback />}>
        <SearchPageClient initialPreferences={preferences} />
      </Suspense>
      <Footer />
    </div>
  );
}
