import { getPersistedPreferences } from "@/features/settings/server/preferences";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 2_500;
const DEFAULT_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";

type FaviconResolver = "duckduckgo" | "google";

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

function normalizeResolver(value: string | null | undefined): FaviconResolver {
  return value === "duckduckgo" ? "duckduckgo" : "google";
}

function getResolverUrl(authority: string, resolver: FaviconResolver) {
  if (resolver === "duckduckgo") {
    return `https://icons.duckduckgo.com/ip2/${authority}.ico`;
  }

  return (
    "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL" +
    `&url=https://${authority}&size=32`
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authority = normalizeAuthority(url.searchParams.get("authority"));

  if (!authority) {
    return new Response(null, { status: 400 });
  }

  const preferences = await getPersistedPreferences();
  const resolver = normalizeResolver(
    url.searchParams.get("resolver") ?? preferences.settings.faviconResolver,
  );
  const upstreamUrl = getResolverUrl(authority, resolver);

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
      "cache-control":
        upstreamResponse.headers.get("cache-control") ?? DEFAULT_CACHE_CONTROL,
      "content-type":
        upstreamResponse.headers.get("content-type") ?? "image/png",
    },
  });
}
