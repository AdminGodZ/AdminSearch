import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { parseSearchRequest } from "@/features/search/server/schema";
import {
  fetchSearxResponse,
  SearchUpstreamError,
} from "@/features/search/server/searx-client";
import { transformSearxResponse } from "@/features/search/server/transform";
import { checkRateLimit, createRateLimitHeaders } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "anonymous";
  }

  return request.headers.get("x-real-ip") ?? "anonymous";
}

export async function GET(request: Request) {
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
    const upstreamResponse = await fetchSearxResponse(searchRequest);
    const payload = transformSearxResponse(
      upstreamResponse.payload,
      searchRequest,
      {
        hasMore: upstreamResponse.hasMore,
      },
    );

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
