import type {
  SearchRequest,
  SearchResponse,
  SearchResult,
  SearxRawResult,
  SearxResponse,
} from "@/lib/search/types";

function readString(record: SearxRawResult, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function readHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function readThumbnail(result: SearxRawResult) {
  return readString(result, [
    "thumbnail_src",
    "img_src",
    "thumbnail",
    "thumbnail_url",
    "img",
  ]);
}

function normalizeResult(
  result: SearxRawResult,
  index: number,
  tab: SearchRequest["tab"],
): SearchResult | null {
  const url = readString(result, ["url", "img_src", "thumbnail_src"]);

  if (!url) {
    return null;
  }

  const hostname = readHostname(url);
  const title =
    readString(result, ["title", "pretty_url"]) ??
    hostname ??
    (tab === "images" ? "Untitled image" : "Untitled result");

  const thumbnailUrl = readThumbnail(result);
  const displayUrl =
    readString(result, ["pretty_url", "parsed_url"]) ?? hostname ?? url;
  const snippet = readString(result, ["content", "snippet", "description"]);
  const engine = readString(result, ["engine"]);

  return {
    id: `${tab}-${index}-${encodeURIComponent(url)}`,
    kind: tab === "images" ? "image" : "web",
    title,
    url,
    displayUrl,
    snippet,
    thumbnailUrl,
    source: hostname,
    engine,
  };
}

function extractAnswers(rawAnswers: unknown[] | undefined) {
  if (!Array.isArray(rawAnswers)) {
    return [];
  }

  return rawAnswers.filter((item): item is string => typeof item === "string");
}

function extractSuggestions(rawSuggestions: unknown[] | undefined) {
  if (!Array.isArray(rawSuggestions)) {
    return [];
  }

  return rawSuggestions.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}

export function transformSearxResponse(
  payload: SearxResponse,
  request: SearchRequest,
): SearchResponse {
  const results = Array.isArray(payload.results)
    ? payload.results
        .map((result, index) => normalizeResult(result, index, request.tab))
        .filter((result): result is SearchResult => result !== null)
    : [];

  const numberOfResults =
    typeof payload.number_of_results === "number"
      ? payload.number_of_results
      : undefined;

  const pageSizeHeuristic = request.tab === "images" ? 24 : 10;
  const hasMore =
    numberOfResults !== undefined
      ? request.page * Math.max(results.length, 1) < numberOfResults
      : results.length >= pageSizeHeuristic;

  return {
    query: request.q,
    tab: request.tab,
    page: request.page,
    results,
    suggestions: extractSuggestions(payload.suggestions),
    answers: extractAnswers(payload.answers),
    infoboxes: Array.isArray(payload.infoboxes) ? payload.infoboxes : [],
    hasMore,
  };
}
