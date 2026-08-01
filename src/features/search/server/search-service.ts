import "server-only";

import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";

import { parseSearchRequest } from "@/features/search/server/schema";
import {
  fetchSearxResponse,
  SearchUpstreamError,
} from "@/features/search/server/searx-client";
import { transformSearxResponse } from "@/features/search/server/transform";
import type { SearchResponse } from "@/features/search/types";
import {
  getSearchRuntimePreferences,
  type PersistedPreferences,
} from "@/features/settings/lib/preferences";
import { getConfiguredEngineTokens } from "@/features/settings/server/engine-tokens";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import {
  getClientIpFromHeaders,
  getForwardableClientIp,
  getForwardableUserAgentFromHeaders,
  type RequestHeaders,
} from "@/server/client-ip";
import { checkRateLimit, createRateLimitHeaders } from "@/server/rate-limit";

type SearchErrorPayload = {
  message: string;
};

type SearchServiceResult =
  | {
      ok: true;
      payload: SearchResponse;
      status: 200;
      headers: Record<string, string>;
    }
  | {
      ok: false;
      payload: SearchErrorPayload;
      status: number;
      headers: Record<string, string>;
    };

type ExecuteSearchOptions = {
  searchParams: URLSearchParams;
  requestHeaders: RequestHeaders;
  preferences?: PersistedPreferences;
  signal?: AbortSignal;
};

export async function executeSearch({
  searchParams,
  requestHeaders,
  preferences,
  signal,
}: ExecuteSearchOptions): Promise<SearchServiceResult> {
  const startedAt = performance.now();
  const clientIp = getClientIpFromHeaders(requestHeaders);
  const [t, rateLimit] = await Promise.all([
    getTranslations("ApiErrors"),
    checkRateLimit(clientIp),
  ]);
  const rateLimitHeaders = createRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return {
      ok: false,
      payload: {
        message: t("tooManySearchRequests"),
      },
      status: 429,
      headers: rateLimitHeaders,
    };
  }

  try {
    signal?.throwIfAborted();
    const searchRequest = parseSearchRequest(searchParams);
    const [resolvedPreferences, searchT] = await Promise.all([
      preferences ?? getPersistedPreferences(),
      getTranslations("Search"),
    ]);
    const runtimePreferences = getSearchRuntimePreferences(
      resolvedPreferences.settings,
      resolvedPreferences.engines,
      searchRequest.tab,
    );
    const selfInfoEnabled =
      runtimePreferences.enabledPlugins.includes("self_info");
    const upstreamResponse = await fetchSearxResponse(searchRequest, {
      ...runtimePreferences,
      clientIp: selfInfoEnabled ? getForwardableClientIp(clientIp) : undefined,
      engineTokens: getConfiguredEngineTokens(),
      signal,
      userAgent: selfInfoEnabled
        ? getForwardableUserAgentFromHeaders(requestHeaders)
        : undefined,
    });
    signal?.throwIfAborted();
    const payload = transformSearxResponse(
      upstreamResponse.payload,
      searchRequest,
      {
        hasMore: upstreamResponse.hasMore,
        labels: {
          instantAnswer: (number) => searchT("instantAnswer", { number }),
          untitledImage: searchT("untitledImage"),
          untitledResult: searchT("untitledResult"),
        },
        nextPageCursor: upstreamResponse.nextPageCursor,
        resultsPerPage: runtimePreferences.resultsPerPage,
      },
    );
    payload.requestDurationMs = performance.now() - startedAt;

    return {
      ok: true,
      payload,
      status: 200,
      headers: rateLimitHeaders,
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }

    if (error instanceof ZodError) {
      return {
        ok: false,
        payload: {
          message: t("invalidSearchParameters"),
        },
        status: 400,
        headers: rateLimitHeaders,
      };
    }

    if (error instanceof SearchUpstreamError) {
      return {
        ok: false,
        payload: {
          message: t(error.code),
        },
        status: error.statusCode,
        headers: rateLimitHeaders,
      };
    }

    return {
      ok: false,
      payload: {
        message: t("unexpectedSearchError"),
      },
      status: 500,
      headers: rateLimitHeaders,
    };
  }
}
