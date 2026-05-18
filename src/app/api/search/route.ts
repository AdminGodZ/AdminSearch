import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { parseSearchRequest } from "@/features/search/server/schema";
import {
  fetchSearxResponse,
  SearchUpstreamError,
} from "@/features/search/server/searx-client";
import { transformSearxResponse } from "@/features/search/server/transform";
import { getSearchRuntimePreferences } from "@/features/settings/lib/preferences";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import { checkRateLimit, createRateLimitHeaders } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_RATE_LIMIT_KEY = "anonymous";
const DEFAULT_TRUSTED_PROXY_HOPS = 1;
const MAX_TRUSTED_PROXY_HOPS = 10;

function shouldTrustProxyHeaders() {
  return process.env.RATE_LIMIT_TRUST_PROXY_HEADERS === "true";
}

function getTrustedProxyHops() {
  const parsed = Number.parseInt(
    process.env.RATE_LIMIT_TRUSTED_PROXY_HOPS ?? "",
    10,
  );

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }

  return Math.min(parsed, MAX_TRUSTED_PROXY_HOPS);
}

function readHeaderList(value: string | null) {
  return (
    value
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean) ?? []
  );
}

function getClientIp(request: Request) {
  if (!shouldTrustProxyHeaders()) {
    return DEFAULT_RATE_LIMIT_KEY;
  }

  const forwardedFor = readHeaderList(request.headers.get("x-forwarded-for"));

  if (forwardedFor.length) {
    const trustedHopIndex = Math.max(
      forwardedFor.length - getTrustedProxyHops(),
      0,
    );

    return forwardedFor[trustedHopIndex] ?? DEFAULT_RATE_LIMIT_KEY;
  }

  return request.headers.get("x-real-ip")?.trim() || DEFAULT_RATE_LIMIT_KEY;
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const rateLimit = await checkRateLimit(getClientIp(request));
  const rateLimitHeaders = createRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        message: "Too many search requests. Please try again shortly.",
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
    const upstreamResponse = await fetchSearxResponse(
      searchRequest,
      runtimePreferences,
    );
    const payload = transformSearxResponse(
      upstreamResponse.payload,
      searchRequest,
      {
        hasMore: upstreamResponse.hasMore,
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
          message: error.issues[0]?.message ?? "Invalid search parameters.",
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
          message: error.message,
        },
        {
          status: error.statusCode,
          headers: rateLimitHeaders,
        },
      );
    }

    return NextResponse.json(
      {
        message: "Unexpected search error.",
      },
      {
        status: 500,
        headers: rateLimitHeaders,
      },
    );
  }
}
