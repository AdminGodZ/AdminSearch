import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  AUTOCOMPLETE_MAX_QUERY_LENGTH,
  AUTOCOMPLETE_MAX_SUGGESTIONS,
  AUTOCOMPLETE_MIN_QUERY_LENGTH,
} from "@/features/search/lib/limits";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import { getClientIp } from "@/server/client-ip";
import { checkRateLimit, createRateLimitHeaders } from "@/server/rate-limit";
import {
  createClientClosedResponse,
  fetchUpstream,
} from "@/server/upstream-fetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_SEARXNG_URL = "http://127.0.0.1:8080";
const REQUEST_TIMEOUT_MS = 5_000;
const AUTOCOMPLETE_RATE_LIMIT_WINDOW_MS = Number(
  process.env.AUTOCOMPLETE_RATE_LIMIT_WINDOW_MS ?? 60_000,
);
const AUTOCOMPLETE_RATE_LIMIT_MAX = Number(
  process.env.AUTOCOMPLETE_RATE_LIMIT_MAX ?? 600,
);

function getSearxBaseUrl() {
  return (process.env.SEARXNG_INTERNAL_URL ?? DEFAULT_SEARXNG_URL).replace(
    /\/$/,
    "",
  );
}

export async function GET(request: Request) {
  const t = await getTranslations("ApiErrors");
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const rateLimit = await checkRateLimit(
    `autocomplete:${getClientIp(request)}`,
    {
      windowMs: AUTOCOMPLETE_RATE_LIMIT_WINDOW_MS,
      maxRequests: AUTOCOMPLETE_RATE_LIMIT_MAX,
    },
  );
  const rateLimitHeaders = createRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: t("tooManyAutocompleteRequests") },
      {
        status: 429,
        headers: rateLimitHeaders,
      },
    );
  }

  if (request.signal.aborted) {
    return createClientClosedResponse(rateLimitHeaders);
  }

  if (
    query.length < AUTOCOMPLETE_MIN_QUERY_LENGTH ||
    query.length > AUTOCOMPLETE_MAX_QUERY_LENGTH
  ) {
    return NextResponse.json(
      { suggestions: [] },
      { headers: rateLimitHeaders },
    );
  }

  const preferences = await getPersistedPreferences();

  if (request.signal.aborted) {
    return createClientClosedResponse(rateLimitHeaders);
  }

  const upstreamUrl = new URL("/autocompleter", getSearxBaseUrl());
  upstreamUrl.searchParams.set("q", query);
  upstreamUrl.searchParams.set(
    "autocomplete",
    preferences.settings.autocomplete,
  );

  let payload: unknown;

  try {
    const response = await fetchUpstream(
      upstreamUrl,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-real-ip": "127.0.0.1",
        },
        cache: "no-store",
      },
      {
        requestSignal: request.signal,
        timeoutMs: REQUEST_TIMEOUT_MS,
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { suggestions: [] },
        { headers: rateLimitHeaders },
      );
    }

    payload = await response.json();
  } catch {
    if (request.signal.aborted) {
      return createClientClosedResponse(rateLimitHeaders);
    }

    return NextResponse.json(
      { suggestions: [] },
      { headers: rateLimitHeaders },
    );
  }

  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    return NextResponse.json(
      { suggestions: [] },
      { headers: rateLimitHeaders },
    );
  }

  const suggestions = payload[1]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim() !== "",
    )
    .slice(0, AUTOCOMPLETE_MAX_SUGGESTIONS);

  return NextResponse.json({ suggestions }, { headers: rateLimitHeaders });
}
