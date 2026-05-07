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
  nextPageCursor?: string;
};

export type SearxRuntimeOptions = {
  disabledPlugins?: string[];
  enabledEngines?: string[];
  enabledPlugins?: string[];
  engineTokens?: string[];
  httpMethod?: "get" | "post";
  imageProxy?: boolean;
  resultsPerPage?: number;
};

type SearxEngineData = Record<string, Record<string, string>>;

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

function createSearxSearchParams(
  request: SearchRequest,
  upstreamPage: number,
  options?: SearxRuntimeOptions,
  engineData?: SearxEngineData,
) {
  const params = new URLSearchParams({
    q: request.q,
    categories: getCategories(request.tab),
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

  if (engineData) {
    for (const [engine, values] of Object.entries(engineData)) {
      for (const [key, value] of Object.entries(values)) {
        params.set(`engine_data-${engine}-${key}`, value);
      }
    }
  }

  return params;
}

function hasEngineData(engineData: SearxEngineData) {
  return Object.values(engineData).some(
    (values) => Object.keys(values).length > 0,
  );
}

function sanitizeEngineData(value: unknown): SearxEngineData {
  const engineData: SearxEngineData = {};

  if (!value || typeof value !== "object") {
    return engineData;
  }

  for (const [engine, rawValues] of Object.entries(value)) {
    if (!rawValues || typeof rawValues !== "object") {
      continue;
    }

    for (const [key, rawValue] of Object.entries(rawValues)) {
      if (typeof rawValue !== "string" || rawValue.trim() === "") {
        continue;
      }

      engineData[engine] = {
        ...engineData[engine],
        [key]: rawValue,
      };
    }
  }

  return engineData;
}

function encodeEngineDataCursor(engineData: SearxEngineData) {
  if (!hasEngineData(engineData)) {
    return undefined;
  }

  return Buffer.from(JSON.stringify(engineData), "utf8").toString("base64url");
}

function decodeEngineDataCursor(cursor: string | undefined) {
  if (!cursor) {
    return {};
  }

  try {
    return sanitizeEngineData(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
  } catch {
    return {};
  }
}

function decodeHtmlAttribute(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function parseEngineDataFromHtml(html: string): SearxEngineData {
  const engineData: SearxEngineData = {};
  const inputPattern =
    /name="engine_data-([^"-]+)-([^"]+)"\s+value="([^"]*)"/gu;

  for (const match of html.matchAll(inputPattern)) {
    const [, engine, key, rawValue] = match;

    if (!engine || !key) {
      continue;
    }

    engineData[engine] = {
      ...engineData[engine],
      [key]: decodeHtmlAttribute(rawValue),
    };
  }

  return engineData;
}

function shouldFetchEngineData(
  request: SearchRequest,
  options?: SearxRuntimeOptions,
) {
  return (
    request.tab === "videos" &&
    (!options?.enabledEngines || options.enabledEngines.includes("youtube"))
  );
}

function getSearxRequestMethod(options?: SearxRuntimeOptions) {
  return options?.httpMethod === "post" ? "POST" : "GET";
}

function createSearxFetchRequest({
  accept,
  options,
  params,
}: {
  accept: string;
  options?: SearxRuntimeOptions;
  params: URLSearchParams;
}) {
  const method = getSearxRequestMethod(options);
  const headers: Record<string, string> = {
    accept,
  };
  const url = new URL("/search", getSearxBaseUrl());

  if (options?.engineTokens?.length) {
    headers.cookie = `tokens=${options.engineTokens.join(",")}`;
  }

  if (method === "POST") {
    headers["content-type"] = "application/x-www-form-urlencoded;charset=UTF-8";

    return {
      init: {
        method,
        headers,
        body: params.toString(),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
      url,
    } satisfies { init: RequestInit; url: URL };
  }

  url.search = params.toString();

  return {
    init: {
      method,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
    url,
  } satisfies { init: RequestInit; url: URL };
}

async function fetchSearxPage(
  request: SearchRequest,
  upstreamPage: number,
  options?: SearxRuntimeOptions,
  engineData?: SearxEngineData,
): Promise<SearxResponse> {
  const params = createSearxSearchParams(
    request,
    upstreamPage,
    options,
    engineData,
  );
  params.set("format", "json");
  const { init, url } = createSearxFetchRequest({
    accept: "application/json",
    options,
    params,
  });

  let response: Response;

  try {
    response = await fetch(url, init);
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

async function fetchSearxEngineData(
  request: SearchRequest,
  upstreamPage: number,
  options?: SearxRuntimeOptions,
  engineData?: SearxEngineData,
) {
  const params = createSearxSearchParams(
    request,
    upstreamPage,
    options,
    engineData,
  );
  const { init, url } = createSearxFetchRequest({
    accept: "text/html",
    options,
    params,
  });

  try {
    const response = await fetch(url, init);

    if (!response.ok) {
      return {};
    }

    return parseEngineDataFromHtml(await response.text());
  } catch {
    return {};
  }
}

async function fetchSearxVideoResponse(
  request: SearchRequest,
  options?: SearxRuntimeOptions,
): Promise<PaginatedSearxResponse> {
  const resultsPerPage = options?.resultsPerPage ?? DEFAULT_RESULTS_PER_PAGE;
  const engineData = decodeEngineDataCursor(request.cursor);
  const hasCursor = hasEngineData(engineData);
  const upstreamPage = hasCursor ? Math.max(request.page, 2) : 1;
  const payload = await fetchSearxPage(
    request,
    upstreamPage,
    options,
    engineData,
  );
  const nextEngineData = await fetchSearxEngineData(
    request,
    upstreamPage,
    options,
    engineData,
  );
  const pageResults = Array.isArray(payload.results) ? payload.results : [];
  const totalAvailable =
    typeof payload.number_of_results === "number" &&
    payload.number_of_results > 0
      ? payload.number_of_results
      : undefined;
  const nextPageCursor = encodeEngineDataCursor(nextEngineData);
  const hasMore =
    Boolean(nextPageCursor) ||
    (totalAvailable !== undefined &&
      totalAvailable > request.page * resultsPerPage);

  return {
    payload: {
      ...payload,
      results: pageResults.slice(0, resultsPerPage),
      number_of_results: totalAvailable,
      suggestions: hasCursor ? [] : payload.suggestions,
      answers: hasCursor ? [] : payload.answers,
      infoboxes: hasCursor ? [] : payload.infoboxes,
    },
    hasMore,
    nextPageCursor,
  };
}

export async function fetchSearxResponse(
  request: SearchRequest,
  options?: SearxRuntimeOptions,
): Promise<PaginatedSearxResponse> {
  if (shouldFetchEngineData(request, options)) {
    return fetchSearxVideoResponse(request, options);
  }

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

    let addedResults = 0;

    for (const result of pageResults) {
      const url = readRawResultUrl(result);

      if (url) {
        if (seenUrls.has(url)) {
          continue;
        }

        seenUrls.add(url);
      }

      aggregatedResults.push(result);
      addedResults += 1;
    }

    if (addedResults === 0) {
      break;
    }

    if (
      totalAvailable !== undefined &&
      totalAvailable > 0 &&
      aggregatedResults.length >= totalAvailable
    ) {
      break;
    }
  }

  const basePayload = firstPayload ?? {};
  const slicedResults = aggregatedResults.slice(startIndex, endIndex);
  const hasMore =
    aggregatedResults.length > endIndex ||
    (totalAvailable !== undefined &&
      totalAvailable > 0 &&
      totalAvailable > endIndex);

  return {
    payload: {
      ...basePayload,
      results: slicedResults,
      number_of_results:
        totalAvailable !== undefined && totalAvailable > 0
          ? totalAvailable
          : aggregatedResults.length,
      suggestions: request.page === 1 ? basePayload.suggestions : [],
      answers: request.page === 1 ? basePayload.answers : [],
      infoboxes: request.page === 1 ? basePayload.infoboxes : [],
    },
    hasMore,
  };
}
