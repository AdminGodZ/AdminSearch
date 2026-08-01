import { SEARCH_MAX_PAGE } from "@/features/search/lib/limits";
import type { SearchRequest, SearxResponse } from "@/features/search/types";
import {
  type EngineGroupKey,
  engineCatalog,
} from "@/features/settings/lib/preferences";
import { fetchUpstream } from "@/server/upstream-fetch";
import {
  createSearchContinuationFingerprint,
  loadSearchContinuation,
  type SearchContinuationState,
  saveSearchContinuation,
  shortenSearchContinuation,
} from "./search-continuation-store";
import {
  type ConsumedSearxResultPage,
  consumeSearxResultPage,
  createSearxPaginationState,
} from "./search-pagination";

const DEFAULT_SEARXNG_URL = "http://127.0.0.1:8080";
const REQUEST_TIMEOUT_MS = 8_000;
export const DEFAULT_RESULTS_PER_PAGE = 20;
const MAX_UPSTREAM_PAGES = SEARCH_MAX_PAGE;

export type SearchUpstreamErrorCode =
  | "backendTimedOut"
  | "backendUnavailable"
  | "backendError"
  | "backendInvalidJson"
  | "backendEmptyBody";

export class SearchUpstreamError extends Error {
  code: SearchUpstreamErrorCode;
  statusCode: number;

  constructor(code: SearchUpstreamErrorCode, statusCode = 503) {
    super(code);
    this.name = "SearchUpstreamError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export type PaginatedSearxResponse = {
  payload: SearxResponse;
  hasMore: boolean;
  nextPageCursor?: string;
};

export type SearxRuntimeOptions = {
  clientIp?: string;
  disabledPlugins?: string[];
  enabledEngines?: string[];
  enabledPlugins?: string[];
  engineTokens?: string[];
  httpMethod?: "get" | "post";
  imageProxy?: boolean;
  resultsPerPage?: number;
  signal?: AbortSignal;
  userAgent?: string;
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

function getEngineGroup(tab: SearchRequest["tab"]): EngineGroupKey {
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

function getDisabledEnginesForSelection(
  group: EngineGroupKey,
  selectedEngines: string[],
) {
  const selected = new Set(selectedEngines);
  const disabledEngines: string[] = [];

  for (const engine of engineCatalog[group]) {
    if (!selected.has(engine)) {
      disabledEngines.push(`${engine}__${group}`);
    }
  }

  return disabledEngines;
}

function createSearxSearchParams(
  request: SearchRequest,
  upstreamPage: number,
  options?: SearxRuntimeOptions,
  engineData?: SearxEngineData,
) {
  const params = new URLSearchParams({
    q: request.q,
    pageno: String(upstreamPage),
    safesearch: String(request.safeSearch ?? 0),
  });

  const category = getCategories(request.tab);
  params.set("categories", category);

  if (options?.enabledEngines?.length) {
    const disabledEngines = getDisabledEnginesForSelection(
      getEngineGroup(request.tab),
      options.enabledEngines,
    );

    if (disabledEngines.length) {
      params.set("disabled_engines", disabledEngines.join(","));
    }
  }

  if (request.language) {
    params.set("language", request.language);
  }

  if (request.timeRange) {
    params.set("time_range", request.timeRange);
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

function decodeLegacyVideoCursor(
  cursor: string | undefined,
  fingerprint: string,
  nextClientPage: number,
) {
  if (!cursor) {
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );

    if (
      value &&
      typeof value === "object" &&
      "version" in value &&
      value.version === 1
    ) {
      const storedCursor = value as {
        fingerprint?: string;
        nextClientPage?: number;
        engineData?: unknown;
      };

      if (
        storedCursor.fingerprint !== fingerprint ||
        storedCursor.nextClientPage !== nextClientPage
      ) {
        return undefined;
      }

      return sanitizeEngineData(storedCursor.engineData);
    }

    const legacyEngineData = sanitizeEngineData(value);
    return hasEngineData(legacyEngineData) ? legacyEngineData : undefined;
  } catch {
    return undefined;
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

  if (options?.clientIp) {
    headers["x-real-ip"] = options.clientIp;
  }

  if (options?.userAgent) {
    headers["user-agent"] = options.userAgent;
  }

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
    response = await fetchUpstream(url, init, {
      requestSignal: options?.signal,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }

    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SearchUpstreamError("backendTimedOut");
    }

    throw new SearchUpstreamError("backendUnavailable");
  }

  if (!response.ok) {
    throw new SearchUpstreamError("backendError");
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }

    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SearchUpstreamError("backendTimedOut");
    }

    throw new SearchUpstreamError("backendInvalidJson");
  }

  if (!payload || typeof payload !== "object") {
    throw new SearchUpstreamError("backendEmptyBody");
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
    const response = await fetchUpstream(url, init, {
      requestSignal: options?.signal,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    if (!response.ok) {
      return {};
    }

    return parseEngineDataFromHtml(await response.text());
  } catch (error) {
    if (options?.signal?.aborted) {
      throw error;
    }

    return {};
  }
}

async function fetchSearxVideoResponse(
  request: SearchRequest,
  options?: SearxRuntimeOptions,
): Promise<PaginatedSearxResponse> {
  const resultsPerPage = options?.resultsPerPage ?? DEFAULT_RESULTS_PER_PAGE;
  const fingerprint = getSearchContinuationFingerprint(request, options);
  let continuation: SearchContinuationState | undefined;
  let usedCursor: string | undefined;

  if (request.page > 1 && request.cursor) {
    const loadedContinuation = await loadSearchContinuation(request.cursor);

    if (
      loadedContinuation?.fingerprint === fingerprint &&
      loadedContinuation.nextClientPage === request.page &&
      loadedContinuation.videoEngineData !== undefined
    ) {
      continuation = loadedContinuation;
      usedCursor = request.cursor;
    } else {
      const legacyEngineData = decodeLegacyVideoCursor(
        request.cursor,
        fingerprint,
        request.page,
      );

      if (legacyEngineData) {
        const pagination = createSearxPaginationState();
        pagination.nextUpstreamPage = request.page;
        continuation = {
          version: 1,
          fingerprint,
          nextClientPage: request.page,
          pagination,
          videoEngineData: legacyEngineData,
        };
      }
    }
  }

  let consumedPage: ConsumedSearxResultPage | undefined;
  let paginationState =
    continuation?.pagination ?? createSearxPaginationState();
  let engineData = continuation?.videoEngineData ?? {};
  const firstClientPage = continuation?.nextClientPage ?? 1;

  for (
    let clientPage = firstClientPage;
    clientPage <= request.page;
    clientPage += 1
  ) {
    let nextEngineData = engineData;
    consumedPage = await consumeSearxResultPage({
      fetchPage: async (upstreamPage) => {
        const [payload, fetchedEngineData] = await Promise.all([
          fetchSearxPage(request, upstreamPage, options, engineData),
          fetchSearxEngineData(request, upstreamPage, options, engineData),
        ]);
        nextEngineData = fetchedEngineData;
        return payload;
      },
      maxPageFetches: 1,
      maxUpstreamPages: MAX_UPSTREAM_PAGES,
      resultsPerPage,
      state: paginationState,
    });
    paginationState = consumedPage.state;
    engineData = nextEngineData;
  }

  if (!consumedPage) {
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

  const canContinue = request.page < SEARCH_MAX_PAGE && consumedPage.hasMore;
  const [nextPageCursor] = await Promise.all([
    canContinue
      ? saveSearchContinuation({
          version: 1,
          fingerprint,
          nextClientPage: request.page + 1,
          pagination: consumedPage.state,
          videoEngineData: engineData,
        })
      : Promise.resolve(undefined),
    usedCursor
      ? shortenSearchContinuation(usedCursor)
      : Promise.resolve(undefined),
  ]);
  const basePayload =
    request.page === 1 ? (consumedPage.firstPayload ?? {}) : {};

  return {
    payload: {
      ...basePayload,
      results: consumedPage.results,
      number_of_results: consumedPage.numberOfResults,
      suggestions: request.page === 1 ? basePayload.suggestions : [],
      answers: request.page === 1 ? basePayload.answers : [],
      infoboxes: request.page === 1 ? basePayload.infoboxes : [],
    },
    hasMore: Boolean(nextPageCursor),
    nextPageCursor,
  };
}

function sortValues(values: string[] | undefined) {
  return values ? [...values].sort() : null;
}

function getSearchContinuationFingerprint(
  request: SearchRequest,
  options?: SearxRuntimeOptions,
) {
  return createSearchContinuationFingerprint({
    query: request.q,
    tab: request.tab,
    language: request.language ?? null,
    timeRange: request.timeRange ?? null,
    safeSearch: request.safeSearch ?? 0,
    runtime: {
      clientIp: options?.clientIp ?? null,
      disabledPlugins: sortValues(options?.disabledPlugins),
      enabledEngines: sortValues(options?.enabledEngines),
      enabledPlugins: sortValues(options?.enabledPlugins),
      engineTokens:
        options?.engineTokens && options.engineTokens.length > 0
          ? createSearchContinuationFingerprint(
              sortValues(options.engineTokens),
            )
          : null,
      httpMethod: options?.httpMethod ?? "get",
      imageProxy: options?.imageProxy ?? null,
      resultsPerPage: options?.resultsPerPage ?? DEFAULT_RESULTS_PER_PAGE,
      userAgent: options?.userAgent ?? null,
    },
  });
}

async function consumeRequestedResultPage({
  continuation,
  options,
  request,
  resultsPerPage,
}: {
  continuation?: SearchContinuationState;
  options?: SearxRuntimeOptions;
  request: SearchRequest;
  resultsPerPage: number;
}) {
  let consumedPage: ConsumedSearxResultPage | undefined;
  let paginationState =
    continuation?.pagination ?? createSearxPaginationState();
  const firstClientPage = continuation?.nextClientPage ?? 1;

  for (
    let clientPage = firstClientPage;
    clientPage <= request.page;
    clientPage += 1
  ) {
    consumedPage = await consumeSearxResultPage({
      fetchPage: (upstreamPage) =>
        fetchSearxPage(request, upstreamPage, options),
      maxUpstreamPages: MAX_UPSTREAM_PAGES,
      resultsPerPage,
      state: paginationState,
    });
    paginationState = consumedPage.state;
  }

  return consumedPage;
}

export async function fetchSearxResponse(
  request: SearchRequest,
  options?: SearxRuntimeOptions,
): Promise<PaginatedSearxResponse> {
  options?.signal?.throwIfAborted();

  if (shouldFetchEngineData(request, options)) {
    return fetchSearxVideoResponse(request, options);
  }

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

  const resultsPerPage = options?.resultsPerPage ?? DEFAULT_RESULTS_PER_PAGE;
  const fingerprint = getSearchContinuationFingerprint(request, options);
  let continuation: SearchContinuationState | undefined;
  let usedCursor: string | undefined;

  if (request.page > 1 && request.cursor) {
    const loadedContinuation = await loadSearchContinuation(request.cursor);

    if (
      loadedContinuation?.fingerprint === fingerprint &&
      loadedContinuation.nextClientPage === request.page
    ) {
      continuation = loadedContinuation;
      usedCursor = request.cursor;
    }
  }

  const consumedPage = await consumeRequestedResultPage({
    continuation,
    options,
    request,
    resultsPerPage,
  });

  if (!consumedPage) {
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

  const canContinue = request.page < SEARCH_MAX_PAGE && consumedPage.hasMore;
  const [nextPageCursor] = await Promise.all([
    canContinue
      ? saveSearchContinuation({
          version: 1,
          fingerprint,
          nextClientPage: request.page + 1,
          pagination: consumedPage.state,
        })
      : Promise.resolve(undefined),
    usedCursor
      ? shortenSearchContinuation(usedCursor)
      : Promise.resolve(undefined),
  ]);
  const basePayload =
    request.page === 1 ? (consumedPage.firstPayload ?? {}) : {};

  return {
    payload: {
      ...basePayload,
      results: consumedPage.results,
      number_of_results: consumedPage.numberOfResults,
      suggestions: request.page === 1 ? basePayload.suggestions : [],
      answers: request.page === 1 ? basePayload.answers : [],
      infoboxes: request.page === 1 ? basePayload.infoboxes : [],
    },
    hasMore: Boolean(nextPageCursor),
    nextPageCursor,
  };
}
