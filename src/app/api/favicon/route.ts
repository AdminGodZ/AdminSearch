import { createHmac } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_SEARXNG_URL = "http://127.0.0.1:8080";
const DEFAULT_SEARXNG_SECRET = "change-this-in-production";
const REQUEST_TIMEOUT_MS = 2_500;
const DEFAULT_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";

function getSearxBaseUrl() {
  return (process.env.SEARXNG_INTERNAL_URL ?? DEFAULT_SEARXNG_URL).replace(
    /\/$/,
    "",
  );
}

function getSearxSecret() {
  return process.env.SEARXNG_SECRET ?? DEFAULT_SEARXNG_SECRET;
}

function normalizeAuthority(value: string | null) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();

  if (
    trimmed === "" ||
    trimmed.includes("/") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes("@") ||
    trimmed.includes(" ")
  ) {
    return undefined;
  }

  return trimmed;
}

function createAuthorityHmac(authority: string) {
  return createHmac("sha256", getSearxSecret()).update(authority).digest("hex");
}

export async function GET(request: Request) {
  const authority = normalizeAuthority(
    new URL(request.url).searchParams.get("authority"),
  );

  if (!authority) {
    return new Response(null, { status: 400 });
  }

  const upstreamUrl = new URL("/favicon_proxy", getSearxBaseUrl());
  upstreamUrl.searchParams.set("authority", authority);
  upstreamUrl.searchParams.set("h", createAuthorityHmac(authority));

  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        accept: "image/*",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return new Response(null, { status: 404 });
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return new Response(null, { status: 404 });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: {
      "content-type":
        upstreamResponse.headers.get("content-type") ?? "image/png",
      "cache-control":
        upstreamResponse.headers.get("cache-control") ?? DEFAULT_CACHE_CONTROL,
    },
  });
}
