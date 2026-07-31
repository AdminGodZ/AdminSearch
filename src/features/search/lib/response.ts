import type { SearchResponse } from "@/features/search/types";

export function mergeSearchResponses(
  current: SearchResponse,
  next: SearchResponse,
) {
  const seen = new Set(
    current.results.map((result) => result.id || result.url),
  );
  const mergedResults = [...current.results];

  for (const result of next.results) {
    const key = result.id || result.url;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    mergedResults.push(result);
  }

  return {
    ...current,
    page: next.page,
    nextPageCursor: next.nextPageCursor,
    totalResults: next.totalResults ?? current.totalResults,
    results: mergedResults,
    hasMore: next.hasMore,
  } satisfies SearchResponse;
}
