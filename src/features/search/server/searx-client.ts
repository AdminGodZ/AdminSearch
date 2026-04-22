import type {
  SearchRequest,
  SearxRawResult,
  SearxResponse,
} from "@/features/search/types";

const DEFAULT_SEARXNG_URL = "http://127.0.0.1:8080";
const REQUEST_TIMEOUT_MS = 8_000;
export const DEFAULT_RESULTS_PER_PAGE = 20;
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

export type SearxRuntimeOptions = {
  disabledPlugins?: string[];
  enabledEngines?: string[];
  enabledPlugins?: string[];
  engineTokens?: string[];
  imageProxy?: boolean;
  resultsPerPage?: number;
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
  options?: SearxRuntimeOptions,
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

  if (options?.enabledEngines?.length) {
    params.set("engines", options.enabledEngines.join(","));
  }

  if (options?.enabledPlugins?.length) {
    params.set("enabled_plugins", options.enabledPlugins.join(","));
  }

  if (options?.disabledPlugins?.length) {
    params.set("disabled_plugins", options.disabledPlugins.join(","));
  }

  if (typeof options?.imageProxy === "boolean") {
    params.set("image_proxy", options.imageProxy ? "True" : "False");
  }

  const url = new URL("/search", getSearxBaseUrl());
  url.search = params.toString();

  let response: Response;

  try {
    const headers: Record<string, string> = {
      accept: "application/json",
    };

    if (options?.engineTokens?.length) {
      headers.cookie = `tokens=${options.engineTokens.join(",")}`;
    }

    response = await fetch(url, {
      method: "GET",
      headers,
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
  options?: SearxRuntimeOptions,
): Promise<PaginatedSearxResponse> {
  const resultsPerPage = options?.resultsPerPage ?? DEFAULT_RESULTS_PER_PAGE;
  const startIndex = (request.page - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const targetResultCount = endIndex + 1;
  const aggregatedResults: SearxRawResult[] = [];
  const seenUrls = new Set<string>();
  let firstPayload: SearxResponse | null = null;
  let totalAvailable: number | undefined;

  if (options?.enabledEngines && options.enabledEngines.length === 0) {
    return {
      payload: {
        number_of_results: 0,
        results: [],
        suggestions: [],
        answers: [],
        infoboxes: [],
      },
      hasMore: false,
    };
  }

  for (
    let upstreamPage = 1;
    upstreamPage <= MAX_UPSTREAM_PAGES &&
    aggregatedResults.length < targetResultCount;
    upstreamPage += 1
  ) {
    const payload = await fetchSearxPage(request, upstreamPage, options);

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
