import type { SearchRequest, SearxResponse } from "@/lib/search/types";

const DEFAULT_SEARXNG_URL = "http://127.0.0.1:8080";
const REQUEST_TIMEOUT_MS = 8_000;

export class SearchUpstreamError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = "SearchUpstreamError";
    this.statusCode = statusCode;
  }
}

function getSearxBaseUrl() {
  return (process.env.SEARXNG_INTERNAL_URL ?? DEFAULT_SEARXNG_URL).replace(
    /\/$/,
    "",
  );
}

function getCategories(tab: SearchRequest["tab"]) {
  return tab === "images" ? "images" : "general";
}

export async function fetchSearxResponse(
  request: SearchRequest,
): Promise<SearxResponse> {
  const params = new URLSearchParams({
    q: request.q,
    categories: getCategories(request.tab),
    format: "json",
    pageno: String(request.page),
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
