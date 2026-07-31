import "server-only";

import { mergeSearchResponses } from "@/features/search/lib/response";
import { executeSearch } from "@/features/search/server/search-service";
import type {
  InitialSearchResult,
  SearchResponse,
} from "@/features/search/types";
import type { PersistedPreferences } from "@/features/settings/lib/preferences";
import type { RequestHeaders } from "@/server/client-ip";

type LoadInitialSearchOptions = {
  queryStringWithoutPage: string;
  requestedPage: number;
  requestHeaders: RequestHeaders;
  preferences: PersistedPreferences;
  requestKey: string;
};

export async function loadInitialSearch({
  queryStringWithoutPage,
  requestedPage,
  requestHeaders,
  preferences,
  requestKey,
}: LoadInitialSearchOptions): Promise<InitialSearchResult> {
  const params = new URLSearchParams(queryStringWithoutPage);
  params.delete("cursor");
  let aggregated: SearchResponse | undefined;
  let nextPageCursor: string | undefined;

  for (let page = 1; page <= requestedPage; page += 1) {
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }

    if (nextPageCursor) {
      params.set("cursor", nextPageCursor);
    } else {
      params.delete("cursor");
    }

    const result = await executeSearch({
      searchParams: params,
      requestHeaders,
      preferences,
    });

    if (!result.ok) {
      return {
        status: "error",
        requestKey,
        message: result.payload.message,
      };
    }

    aggregated = aggregated
      ? mergeSearchResponses(aggregated, result.payload)
      : result.payload;
    nextPageCursor = result.payload.nextPageCursor;

    if (!result.payload.hasMore) {
      break;
    }
  }

  if (!aggregated) {
    throw new Error("Initial search completed without a response payload.");
  }

  return {
    status: "success",
    requestKey,
    data: aggregated,
  };
}
