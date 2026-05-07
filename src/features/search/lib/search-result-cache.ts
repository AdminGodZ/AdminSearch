import type { SearchResponse } from "@/features/search/types";

type SearchCacheEntry = {
  data: SearchResponse;
  cachedAt: number;
};

type SearchCachePayload = {
  entries?: Array<[string, SearchCacheEntry]>;
  version?: number;
};

const SEARCH_CACHE_STORAGE_KEY = "adminsearch-search-results-cache-v2";
export const SEARCH_CACHE_VERSION = 2;
const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 20;
const searchCache = new Map<string, SearchCacheEntry>();
let hasLoadedSessionCache = false;

function pruneSearchCache() {
  const now = Date.now();

  for (const [key, entry] of searchCache) {
    if (now - entry.cachedAt > SEARCH_CACHE_TTL_MS) {
      searchCache.delete(key);
    }
  }

  const entries = [...searchCache.entries()].sort(
    (first, second) => second[1].cachedAt - first[1].cachedAt,
  );

  for (const [key] of entries.slice(SEARCH_CACHE_MAX_ENTRIES)) {
    searchCache.delete(key);
  }
}

function loadSessionSearchCache() {
  if (hasLoadedSessionCache || typeof window === "undefined") {
    return;
  }

  hasLoadedSessionCache = true;

  try {
    const rawValue = window.sessionStorage.getItem(SEARCH_CACHE_STORAGE_KEY);

    if (!rawValue) {
      return;
    }

    const payload = JSON.parse(rawValue) as SearchCachePayload;

    if (
      payload.version !== SEARCH_CACHE_VERSION ||
      !Array.isArray(payload.entries)
    ) {
      return;
    }

    for (const [key, entry] of payload.entries) {
      if (
        typeof key === "string" &&
        entry &&
        typeof entry.cachedAt === "number" &&
        entry.data
      ) {
        searchCache.set(key, entry);
      }
    }

    pruneSearchCache();
  } catch {
    searchCache.clear();
  }
}

function persistSessionSearchCache() {
  if (typeof window === "undefined") {
    return;
  }

  pruneSearchCache();

  const entries = [...searchCache.entries()].sort(
    (first, second) => second[1].cachedAt - first[1].cachedAt,
  );

  try {
    window.sessionStorage.setItem(
      SEARCH_CACHE_STORAGE_KEY,
      JSON.stringify({
        version: SEARCH_CACHE_VERSION,
        entries,
      } satisfies SearchCachePayload),
    );
  } catch {
    try {
      window.sessionStorage.setItem(
        SEARCH_CACHE_STORAGE_KEY,
        JSON.stringify({
          version: SEARCH_CACHE_VERSION,
          entries: entries.slice(0, Math.ceil(entries.length / 2)),
        } satisfies SearchCachePayload),
      );
    } catch {
      // Storage quota can be smaller than result payloads; the in-memory cache still works for route transitions.
    }
  }
}

export function writeSearchCache(key: string, data: SearchResponse) {
  loadSessionSearchCache();

  searchCache.set(key, {
    data,
    cachedAt: Date.now(),
  });
  persistSessionSearchCache();
}

export function readSearchCache(key: string, requestedPage: number) {
  loadSessionSearchCache();

  const entry = searchCache.get(key);

  if (!entry) {
    return undefined;
  }

  if (Date.now() - entry.cachedAt > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    persistSessionSearchCache();
    return undefined;
  }

  if (entry.data.page < requestedPage) {
    return undefined;
  }

  return entry.data;
}
