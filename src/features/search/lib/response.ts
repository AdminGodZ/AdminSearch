import type { SearchResponse, SearchResult } from "@/features/search/types";
import { mergeProviderFailures } from "./provider-failures.ts";
import {
  getResultEngines,
  mergeResultEngines,
  rankResultsByEngineConsensus,
} from "./result-engines.ts";

function mergeDuplicateResult(
  current: SearchResult,
  duplicate: SearchResult,
): SearchResult {
  const currentEngines = getResultEngines(current);
  const mergedEngines = mergeResultEngines(current, duplicate);

  if (currentEngines.length === mergedEngines.length) {
    return current;
  }

  return {
    ...current,
    engine: current.engine ?? duplicate.engine,
    engines: mergedEngines,
  };
}

export function mergeSearchResponses(
  current: SearchResponse,
  next: SearchResponse,
) {
  const resultIndexes = new Map<string, number>();
  const mergedResults: SearchResult[] = [];

  for (const result of [...current.results, ...next.results]) {
    const existingIndex = resultIndexes.get(result.url);

    if (existingIndex !== undefined) {
      mergedResults[existingIndex] = mergeDuplicateResult(
        mergedResults[existingIndex],
        result,
      );
      continue;
    }

    resultIndexes.set(result.url, mergedResults.length);
    mergedResults.push(result);
  }

  return {
    ...current,
    page: next.page,
    nextPageCursor: next.nextPageCursor,
    totalResults: next.totalResults ?? current.totalResults,
    results: rankResultsByEngineConsensus(mergedResults),
    providerFailures: mergeProviderFailures(
      current.providerFailures,
      next.providerFailures,
    ),
    hasMore: next.hasMore,
  } satisfies SearchResponse;
}
