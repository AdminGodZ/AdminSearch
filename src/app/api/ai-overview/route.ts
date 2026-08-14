import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import {
  AI_OVERVIEW_MAX_REQUEST_BYTES,
  AI_OVERVIEW_MAX_RESPONSE_BYTES,
  normalizeAiOverviewRequest,
  readAiOverviewText,
} from "@/features/search/lib/ai-overview";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import { getClientIp } from "@/server/client-ip";
import { checkRateLimit, createRateLimitHeaders } from "@/server/rate-limit";
import {
  createClientClosedResponse,
  fetchUpstream,
} from "@/server/upstream-fetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_AI_OVERVIEW_API_URL = "https://brief.priv.au/v1/overview";
const REQUEST_TIMEOUT_MS = 35_000;
const AI_OVERVIEW_RATE_LIMIT_WINDOW_MS = Number(
  process.env.AI_OVERVIEW_RATE_LIMIT_WINDOW_MS ?? 60_000,
);
const AI_OVERVIEW_RATE_LIMIT_MAX = Number(
  process.env.AI_OVERVIEW_RATE_LIMIT_MAX ?? 10,
);

function getAiOverviewApiUrl() {
  const configured =
    process.env.AI_OVERVIEW_API_URL?.trim() || DEFAULT_AI_OVERVIEW_API_URL;

  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}

function hasOversizedContentLength(
  message: Pick<Request, "headers"> | Pick<Response, "headers">,
  maxBytes: number,
) {
  const contentLength = Number(message.headers.get("content-length"));
  return Number.isFinite(contentLength) && contentLength > maxBytes;
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export async function POST(request: Request) {
  const t = await getTranslations("ApiErrors");
  const rateLimit = await checkRateLimit(
    `ai-overview:${getClientIp(request)}`,
    {
      windowMs: AI_OVERVIEW_RATE_LIMIT_WINDOW_MS,
      maxRequests: AI_OVERVIEW_RATE_LIMIT_MAX,
    },
  );
  const rateLimitHeaders = createRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: t("tooManyAiOverviewRequests") },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  if (request.signal.aborted) {
    return createClientClosedResponse(rateLimitHeaders);
  }

  const preferences = await getPersistedPreferences();

  if (!preferences.settings.aiOverview) {
    return NextResponse.json(
      { message: t("aiOverviewDisabled") },
      { status: 403, headers: rateLimitHeaders },
    );
  }

  if (hasOversizedContentLength(request, AI_OVERVIEW_MAX_REQUEST_BYTES)) {
    return NextResponse.json(
      { message: t("invalidAiOverviewRequest") },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { message: t("invalidAiOverviewRequest") },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  if (getUtf8ByteLength(rawBody) > AI_OVERVIEW_MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { message: t("invalidAiOverviewRequest") },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { message: t("invalidAiOverviewRequest") },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  const payload = normalizeAiOverviewRequest(parsedBody);
  const upstreamUrl = getAiOverviewApiUrl();

  if (!payload) {
    return NextResponse.json(
      { message: t("invalidAiOverviewRequest") },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  if (!upstreamUrl) {
    return NextResponse.json(
      { message: t("aiOverviewUnavailable") },
      { status: 502, headers: rateLimitHeaders },
    );
  }

  try {
    const response = await fetchUpstream(
      upstreamUrl,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
      {
        requestSignal: request.signal,
        timeoutMs: REQUEST_TIMEOUT_MS,
      },
    );

    if (
      !response.ok ||
      hasOversizedContentLength(response, AI_OVERVIEW_MAX_RESPONSE_BYTES)
    ) {
      throw new Error("AI overview upstream rejected the request");
    }

    const responseBody = await response.text();

    if (getUtf8ByteLength(responseBody) > AI_OVERVIEW_MAX_RESPONSE_BYTES) {
      throw new Error("AI overview upstream response was too large");
    }

    const text = readAiOverviewText(JSON.parse(responseBody));

    if (!text) {
      throw new Error("AI overview upstream returned no text");
    }

    return NextResponse.json(
      { text },
      {
        headers: {
          ...rateLimitHeaders,
          "cache-control": "no-store",
        },
      },
    );
  } catch {
    if (request.signal.aborted) {
      return createClientClosedResponse(rateLimitHeaders);
    }

    return NextResponse.json(
      { message: t("aiOverviewUnavailable") },
      { status: 502, headers: rateLimitHeaders },
    );
  }
}
