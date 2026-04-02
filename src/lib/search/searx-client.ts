import type {
  SearchRequest,
  SearxRawResult,
  SearxResponse,
} from "@/lib/search/types";

const DEFAULT_SEARXNG_URL = "http://127.0.0.1:8080";
const REQUEST_TIMEOUT_MS = 8_000;
export const APP_RESULTS_PER_PAGE = 20;
const MAX_UPSTREAM_PAGES = 12;

export class SearchUpstreamError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = "SearchUpstreamError";
    this.statusCode = statusCode;
  }
}

export type PaginatedSearxResponse = {
  payload: SearxResponse;
  hasMore: boolean;
};

function getSearxBaseUrl() {
  return (process.env.SEARXNG_INTERNAL_URL ?? DEFAULT_SEARXNG_URL).replace(
    /\/$/,
    "",
  );
}

function getCategories(tab: SearchRequest["tab"]) {
  switch (tab) {
    case "images":
      return "images";
    case "videos":
      return "videos";
    case "news":
      return "news";
    default:
      return "general";
  }
}

function readRawResultUrl(result: SearxRawResult) {
  const keys = ["url", "img_src", "thumbnail_src"] as const;

  for (const key of keys) {
    const value = result[key];

    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return undefined;
}

async function fetchSearxPage(
  request: SearchRequest,
  upstreamPage: number,
): Promise<SearxResponse> {
  const params = new URLSearchParams({
    q: request.q,
    categories: getCategories(request.tab),
    format: "json",
    pageno: String(upstreamPage),
    safesearch: String(request.safeSearch ?? 0),
  });

  if (request.language) {
    params.set("language", request.language);
  }

  if (request.timeRange) {
    params.set("time_range", request.timeRange);
  }

  const url = new URL("/search", getSearxBaseUrl());
  url.search = params.toString();

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SearchUpstreamError("The search backend timed out.");
    }

    throw new SearchUpstreamError("The search backend is unavailable.");
  }

  if (!response.ok) {
    throw new SearchUpstreamError("The search backend returned an error.");
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new SearchUpstreamError("The search backend returned invalid JSON.");
  }

  if (!payload || typeof payload !== "object") {
    throw new SearchUpstreamError("The search backend returned an empty body.");
  }

  return payload as SearxResponse;
}

export async function fetchSearxResponse(
  request: SearchRequest,
): Promise<PaginatedSearxResponse> {
  const startIndex = (request.page - 1) * APP_RESULTS_PER_PAGE;
  const endIndex = startIndex + APP_RESULTS_PER_PAGE;
  const targetResultCount = endIndex + 1;
  const aggregatedResults: SearxRawResult[] = [];
  const seenUrls = new Set<string>();
  let firstPayload: SearxResponse | null = null;
  let totalAvailable: number | undefined;

  for (
    let upstreamPage = 1;
    upstreamPage <= MAX_UPSTREAM_PAGES &&
    aggregatedResults.length < targetResultCount;
    upstreamPage += 1
  ) {
    const payload = await fetchSearxPage(request, upstreamPage);

    if (upstreamPage === 1) {
      firstPayload = payload;
    }

    if (typeof payload.number_of_results === "number") {
      totalAvailable = payload.number_of_results;
    }

    const pageResults = Array.isArray(payload.results) ? payload.results : [];

    if (pageResults.length === 0) {
      break;
    }

    for (const result of pageResults) {
      const url = readRawResultUrl(result);

      if (url) {
        if (seenUrls.has(url)) {
          continue;
        }

        seenUrls.add(url);
      }

      aggregatedResults.push(result);
    }

    if (
      totalAvailable !== undefined &&
      aggregatedResults.length >= totalAvailable
    ) {
      break;
    }
  }

  const basePayload = firstPayload ?? {};
  const slicedResults = aggregatedResults.slice(startIndex, endIndex);
  const hasMore =
    aggregatedResults.length > endIndex ||
    (totalAvailable !== undefined && totalAvailable > endIndex);

  return {
    payload: {
      ...basePayload,
      results: slicedResults,
      number_of_results: totalAvailable ?? aggregatedResults.length,
      suggestions: request.page === 1 ? basePayload.suggestions : [],
      answers: request.page === 1 ? basePayload.answers : [],
      infoboxes: request.page === 1 ? basePayload.infoboxes : [],
    },
    hasMore,
  };
}
