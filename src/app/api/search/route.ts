import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { ZodError } from "zod";

import { parseSearchRequest } from "@/features/search/server/schema";
import {
  fetchSearxResponse,
  SearchUpstreamError,
} from "@/features/search/server/searx-client";
import { transformSearxResponse } from "@/features/search/server/transform";
import { getSearchRuntimePreferences } from "@/features/settings/lib/preferences";
import { getConfiguredEngineTokens } from "@/features/settings/server/engine-tokens";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import { getClientIp } from "@/server/client-ip";
import { checkRateLimit, createRateLimitHeaders } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const t = await getTranslations("ApiErrors");
  const searchT = await getTranslations("Search");
  const startedAt = performance.now();
  const rateLimit = await checkRateLimit(getClientIp(request));
  const rateLimitHeaders = createRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        message: t("tooManySearchRequests"),
      },
      {
        status: 429,
        headers: rateLimitHeaders,
      },
    );
  }

  try {
    const searchRequest = parseSearchRequest(new URL(request.url).searchParams);
    const preferences = await getPersistedPreferences();
    const runtimePreferences = getSearchRuntimePreferences(
      preferences.settings,
      preferences.engines,
      searchRequest.tab,
    );
    const engineTokens = getConfiguredEngineTokens();
    const upstreamResponse = await fetchSearxResponse(searchRequest, {
      ...runtimePreferences,
      engineTokens,
    });
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

    return NextResponse.json(payload, {
      headers: rateLimitHeaders,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: t("invalidSearchParameters"),
        },
        {
          status: 400,
          headers: rateLimitHeaders,
        },
      );
    }

    if (error instanceof SearchUpstreamError) {
      return NextResponse.json(
        {
          message: t(error.code),
        },
        {
          status: error.statusCode,
          headers: rateLimitHeaders,
        },
      );
    }

    return NextResponse.json(
      {
        message: t("unexpectedSearchError"),
      },
      {
        status: 500,
        headers: rateLimitHeaders,
      },
    );
  }
}
