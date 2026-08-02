import type { Metadata } from "next";
import { headers } from "next/headers";
import { getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ScopedIntlClientProvider } from "@/components/providers/scoped-intl-client-provider";
import { Footer } from "@/components/site/footer";
import { SearchPageClient } from "@/features/search/components/search-page-client";
import { SearchPageFallback } from "@/features/search/components/search-page-fallback";
import {
  createSearchRequestKey,
  createSearchRuntimeKey,
} from "@/features/search/lib/request-key";
import {
  applySearchPreferenceDefaults,
  normalizeSearchPage,
} from "@/features/search/lib/url-state";
import { loadInitialSearch } from "@/features/search/server/initial-search";
import { getSearchPreferenceDefaults } from "@/features/settings/lib/preferences";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import {
  pickClientMessages,
  ROUTE_CLIENT_MESSAGE_NAMESPACES,
} from "@/i18n/client-messages";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toUrlSearchParams(
  values: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }

  return params;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return { title: t("searchTitle") };
}

async function SearchPageContent({ searchParams }: SearchPageProps) {
  const [resolvedSearchParams, requestHeaders, messages, preferences] =
    await Promise.all([
      searchParams,
      headers(),
      getMessages(),
      getPersistedPreferences(),
    ]);
  const defaults = getSearchPreferenceDefaults(preferences.settings);
  const effectiveParams = applySearchPreferenceDefaults(
    toUrlSearchParams(resolvedSearchParams),
    defaults,
  );
  const currentQuery = effectiveParams.get("q")?.trim() ?? "";
  const requestedPage = normalizeSearchPage(effectiveParams.get("page"));
  const paramsWithoutPage = new URLSearchParams(effectiveParams);
  paramsWithoutPage.delete("page");
  const queryStringWithoutPage = paramsWithoutPage.toString();
  const requestKey = createSearchRequestKey(
    queryStringWithoutPage,
    requestedPage,
    createSearchRuntimeKey(preferences),
  );
  const initialSearchPromise = currentQuery
    ? loadInitialSearch({
        queryStringWithoutPage,
        requestedPage,
        requestHeaders,
        preferences,
        requestKey,
      })
    : undefined;

  return (
    <ScopedIntlClientProvider
      messages={pickClientMessages(
        messages,
        ROUTE_CLIENT_MESSAGE_NAMESPACES.search,
      )}
    >
      <Suspense fallback={<SearchPageFallback />}>
        <SearchPageClient
          initialPreferences={preferences}
          initialSearchPromise={initialSearchPromise}
        />
      </Suspense>
    </ScopedIntlClientProvider>
  );
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Suspense fallback={<SearchPageFallback />}>
        <SearchPageContent searchParams={searchParams} />
      </Suspense>
      <Footer />
    </div>
  );
}
