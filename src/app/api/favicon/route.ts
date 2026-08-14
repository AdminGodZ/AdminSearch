import {
  createFaviconCache,
  type FaviconPayload,
  type FaviconResolver,
  isUsableFaviconPayload,
  normalizeFaviconAuthority,
  normalizeFaviconContentType,
  resolveFaviconResolver,
} from "@/features/search/server/favicon-cache";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import {
  createClientClosedResponse,
  fetchUpstream,
} from "@/server/upstream-fetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 2_500;
const MAX_FAVICON_BYTES = 256 * 1024;
const SUCCESS_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";
const NEGATIVE_CACHE_CONTROL = "public, max-age=300";
const faviconCache = createFaviconCache({
  maxBytes: 4 * 1024 * 1024,
  maxEntries: 256,
  negativeTtlMs: 5 * 60 * 1000,
  successTtlMs: 24 * 60 * 60 * 1000,
});

function getResolverUrl(authority: string, resolver: FaviconResolver) {
  if (resolver === "duckduckgo") {
    return `https://icons.duckduckgo.com/ip2/${authority}.ico`;
  }

  if (resolver === "kagi") {
    return `https://news.kagi.com/api/favicon-proxy?domain=${encodeURIComponent(authority)}&quality=fast`;
  }

  if (resolver === "yandex") {
    return `https://favicon.yandex.net/favicon/${encodeURIComponent(authority)}`;
  }

  return (
    "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL" +
    `&url=https://${authority}&size=32`
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authority = normalizeFaviconAuthority(
    url.searchParams.get("authority"),
  );

  if (!authority) {
    return new Response(null, { status: 400 });
  }

  if (request.signal.aborted) {
    return createClientClosedResponse();
  }

  const resolver = await resolveFaviconResolver(
    url.searchParams.get("resolver"),
    async () => (await getPersistedPreferences()).settings.faviconResolver,
  );

  if (request.signal.aborted) {
    return createClientClosedResponse();
  }

  const payload = await faviconCache.getOrLoad(
    `${resolver}:${authority}`,
    async (): Promise<FaviconPayload | null> => {
      let upstreamResponse: Response;

      try {
        upstreamResponse = await fetchUpstream(
          getResolverUrl(authority, resolver),
          {
            method: "GET",
            headers: {
              accept: "image/*",
            },
          },
          {
            timeoutMs: REQUEST_TIMEOUT_MS,
          },
        );
      } catch {
        return null;
      }

      const contentType = normalizeFaviconContentType(
        upstreamResponse.headers.get("content-type"),
      );
      const declaredLength = Number(
        upstreamResponse.headers.get("content-length"),
      );

      if (
        !upstreamResponse.ok ||
        !upstreamResponse.body ||
        !contentType ||
        (Number.isFinite(declaredLength) && declaredLength > MAX_FAVICON_BYTES)
      ) {
        return null;
      }

      const body = await upstreamResponse.arrayBuffer();

      if (
        !isUsableFaviconPayload(resolver, body.byteLength) ||
        body.byteLength > MAX_FAVICON_BYTES
      ) {
        return null;
      }

      return {
        body,
        contentType,
      };
    },
  );

  if (request.signal.aborted) {
    return createClientClosedResponse();
  }

  if (!payload) {
    return new Response(null, {
      status: 404,
      headers: {
        "cache-control": NEGATIVE_CACHE_CONTROL,
      },
    });
  }

  return new Response(payload.body, {
    status: 200,
    headers: {
      "cache-control": SUCCESS_CACHE_CONTROL,
      "content-type": payload.contentType,
    },
  });
}
