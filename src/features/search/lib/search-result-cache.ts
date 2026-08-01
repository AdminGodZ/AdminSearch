import type { SearchResponse } from "@/features/search/types";

type ResultReuseMode = "cache" | "fresh";

type SearchCacheEntry = {
  data: SearchResponse;
  cachedAt: number;
};

type SearchCacheIndexEntry = {
  bytes: number;
  cachedAt: number;
  key: string;
};

type SearchCacheIndexPayload = {
  entries?: SearchCacheIndexEntry[];
  version?: number;
};

type SearchCacheStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type SearchResultCacheOptions = {
  byteLength?: (value: string) => number;
  maxBytes?: number;
  maxEntries?: number;
  now?: () => number;
  schedulePersistence?: (callback: () => void) => void;
  storage?: SearchCacheStorage;
  storageNamespace?: string;
  ttlMs?: number;
};

export const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
export const SEARCH_CACHE_MAX_ENTRIES = 20;
export const SEARCH_CACHE_MAX_BYTES = 2 * 1024 * 1024;

const SEARCH_CACHE_INDEX_VERSION = 1;
const SEARCH_CACHE_MAX_KEY_LENGTH = 4096;
const DEFAULT_STORAGE_NAMESPACE =
  "adminsearch-search-results-cache:incremental-v1";
const LEGACY_STORAGE_KEY = "adminsearch-search-results-cache-v4";

function defaultByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function isValidIndexEntry(value: unknown): value is SearchCacheIndexEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<SearchCacheIndexEntry>;

  return (
    typeof entry.key === "string" &&
    entry.key.length <= SEARCH_CACHE_MAX_KEY_LENGTH &&
    typeof entry.cachedAt === "number" &&
    Number.isFinite(entry.cachedAt) &&
    typeof entry.bytes === "number" &&
    Number.isFinite(entry.bytes) &&
    entry.bytes >= 0
  );
}

function isValidCacheEntry(value: unknown): value is SearchCacheEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<SearchCacheEntry>;

  return (
    typeof entry.cachedAt === "number" &&
    Number.isFinite(entry.cachedAt) &&
    Boolean(entry.data) &&
    typeof entry.data?.page === "number"
  );
}

export function createSearchResultCache({
  byteLength = defaultByteLength,
  maxBytes = SEARCH_CACHE_MAX_BYTES,
  maxEntries = SEARCH_CACHE_MAX_ENTRIES,
  now = Date.now,
  schedulePersistence = (callback) => callback(),
  storage,
  storageNamespace = DEFAULT_STORAGE_NAMESPACE,
  ttlMs = SEARCH_CACHE_TTL_MS,
}: SearchResultCacheOptions = {}) {
  const indexStorageKey = `${storageNamespace}:index`;
  const entryStoragePrefix = `${storageNamespace}:entry:`;
  const memoryCache = new Map<string, SearchCacheEntry>();
  const persistedIndex = new Map<string, SearchCacheIndexEntry>();
  const pendingKeys = new Set<string>();
  let hasLoadedIndex = false;
  let persistenceScheduled = false;

  function entryStorageKey(key: string) {
    return `${entryStoragePrefix}${encodeURIComponent(key)}`;
  }

  function safelyRemoveStoredEntry(key: string) {
    try {
      storage?.removeItem(entryStorageKey(key));
    } catch {
      // Browser storage can be unavailable; the bounded in-memory cache still works.
    }
  }

  function removePersistedEntry(key: string) {
    persistedIndex.delete(key);
    safelyRemoveStoredEntry(key);
  }

  function loadIndex() {
    if (hasLoadedIndex || !storage) {
      return;
    }

    hasLoadedIndex = true;

    try {
      storage.removeItem(LEGACY_STORAGE_KEY);
      const rawValue = storage.getItem(indexStorageKey);

      if (!rawValue) {
        return;
      }

      const payload = JSON.parse(rawValue) as SearchCacheIndexPayload;

      if (
        payload.version !== SEARCH_CACHE_INDEX_VERSION ||
        !Array.isArray(payload.entries)
      ) {
        storage.removeItem(indexStorageKey);
        return;
      }

      const currentTime = now();
      const validEntries = payload.entries
        .filter(isValidIndexEntry)
        .sort((first, second) => second.cachedAt - first.cachedAt);
      let needsIndexRewrite = validEntries.length !== payload.entries.length;
      let retainedBytes = 0;

      for (const entry of validEntries) {
        if (persistedIndex.has(entry.key)) {
          needsIndexRewrite = true;
          continue;
        }

        const isExpired = currentTime - entry.cachedAt > ttlMs;
        const exceedsBounds =
          persistedIndex.size >= maxEntries ||
          retainedBytes + entry.bytes > maxBytes;

        if (isExpired || exceedsBounds) {
          safelyRemoveStoredEntry(entry.key);
          needsIndexRewrite = true;
          continue;
        }

        persistedIndex.set(entry.key, entry);
        retainedBytes += entry.bytes;
      }

      if (needsIndexRewrite) {
        scheduleFlush();
      }
    } catch {
      persistedIndex.clear();

      try {
        storage.removeItem(indexStorageKey);
      } catch {
        // Ignore storage access failures and retain memory-only behavior.
      }
    }
  }

  function pruneMemoryCache() {
    const currentTime = now();

    for (const [key, entry] of memoryCache) {
      if (currentTime - entry.cachedAt > ttlMs) {
        memoryCache.delete(key);
        pendingKeys.add(key);
      }
    }

    const entries = [...memoryCache.entries()].sort(
      (first, second) => second[1].cachedAt - first[1].cachedAt,
    );

    for (const [key] of entries.slice(maxEntries)) {
      memoryCache.delete(key);
    }
  }

  function persistIndex(writtenKeys: Set<string>) {
    if (!storage) {
      return;
    }

    try {
      if (persistedIndex.size === 0) {
        storage.removeItem(indexStorageKey);
        return;
      }

      storage.setItem(
        indexStorageKey,
        JSON.stringify({
          version: SEARCH_CACHE_INDEX_VERSION,
          entries: [...persistedIndex.values()].sort(
            (first, second) => second.cachedAt - first.cachedAt,
          ),
        } satisfies SearchCacheIndexPayload),
      );
    } catch {
      // Do not retry a large serialization after quota/security failures.
      for (const key of writtenKeys) {
        removePersistedEntry(key);
      }
    }
  }

  function makeRoomForEntry(key: string, bytes: number) {
    let retainedBytes = [...persistedIndex.values()].reduce(
      (total, entry) => total + entry.bytes,
      0,
    );
    const existingBytes = persistedIndex.get(key)?.bytes ?? 0;
    retainedBytes -= existingBytes;

    const oldestEntries = [...persistedIndex.values()]
      .filter((entry) => entry.key !== key)
      .sort((first, second) => first.cachedAt - second.cachedAt);

    while (
      oldestEntries.length > 0 &&
      (retainedBytes + bytes > maxBytes ||
        persistedIndex.size - (persistedIndex.has(key) ? 1 : 0) >= maxEntries)
    ) {
      const oldest = oldestEntries.shift();

      if (!oldest) {
        break;
      }

      retainedBytes -= oldest.bytes;
      removePersistedEntry(oldest.key);
    }
  }

  function flushPersistence() {
    persistenceScheduled = false;
    loadIndex();

    if (!storage) {
      pendingKeys.clear();
      return;
    }

    pruneMemoryCache();
    const keysToPersist = [...pendingKeys];
    const writtenKeys = new Set<string>();
    pendingKeys.clear();

    for (const key of keysToPersist) {
      const entry = memoryCache.get(key);

      if (!entry) {
        removePersistedEntry(key);
        continue;
      }

      let serializedEntry: string;

      try {
        serializedEntry = JSON.stringify(entry);
      } catch {
        removePersistedEntry(key);
        continue;
      }

      const bytes = byteLength(serializedEntry);

      if (bytes > maxBytes) {
        removePersistedEntry(key);
        continue;
      }

      makeRoomForEntry(key, bytes);

      try {
        storage.setItem(entryStorageKey(key), serializedEntry);
        persistedIndex.set(key, {
          key,
          cachedAt: entry.cachedAt,
          bytes,
        });
        writtenKeys.add(key);
      } catch {
        removePersistedEntry(key);
      }
    }

    persistIndex(writtenKeys);
  }

  function scheduleFlush() {
    if (persistenceScheduled || !storage) {
      return;
    }

    persistenceScheduled = true;

    try {
      schedulePersistence(flushPersistence);
    } catch {
      persistenceScheduled = false;
    }
  }

  function write(mode: ResultReuseMode, key: string, data: SearchResponse) {
    if (mode !== "cache" || key.length > SEARCH_CACHE_MAX_KEY_LENGTH) {
      return;
    }

    loadIndex();
    memoryCache.set(key, {
      data,
      cachedAt: now(),
    });
    pendingKeys.add(key);
    pruneMemoryCache();
    scheduleFlush();
  }

  function read(mode: ResultReuseMode, key: string, requestedPage: number) {
    if (mode !== "cache" || key.length > SEARCH_CACHE_MAX_KEY_LENGTH) {
      return undefined;
    }

    loadIndex();
    let entry = memoryCache.get(key);

    if (!entry && persistedIndex.has(key) && storage) {
      try {
        const indexEntry = persistedIndex.get(key);
        const rawEntry = storage.getItem(entryStorageKey(key));
        const hasExpectedSize =
          rawEntry !== null &&
          indexEntry !== undefined &&
          byteLength(rawEntry) === indexEntry.bytes;
        const parsedEntry = hasExpectedSize
          ? (JSON.parse(rawEntry) as unknown)
          : null;

        if (
          isValidCacheEntry(parsedEntry) &&
          parsedEntry.cachedAt === indexEntry?.cachedAt
        ) {
          entry = parsedEntry;
          memoryCache.set(key, entry);
        } else {
          removePersistedEntry(key);
          scheduleFlush();
        }
      } catch {
        removePersistedEntry(key);
        scheduleFlush();
      }
    }

    if (!entry) {
      return undefined;
    }

    if (now() - entry.cachedAt > ttlMs) {
      memoryCache.delete(key);
      pendingKeys.add(key);
      scheduleFlush();
      return undefined;
    }

    if (entry.data.page < requestedPage) {
      return undefined;
    }

    return entry.data;
  }

  return {
    flush: flushPersistence,
    read,
    write,
  };
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function scheduleBrowserPersistence(callback: () => void) {
  if (typeof window === "undefined") {
    return;
  }

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => callback(), { timeout: 1_000 });
    return;
  }

  window.setTimeout(callback, 50);
}

const browserSearchCache = createSearchResultCache({
  storage: getBrowserStorage(),
  schedulePersistence: scheduleBrowserPersistence,
});

export function writeSearchCache(
  mode: ResultReuseMode,
  key: string,
  data: SearchResponse,
) {
  browserSearchCache.write(mode, key, data);
}

export function readSearchCache(
  mode: ResultReuseMode,
  key: string,
  requestedPage: number,
) {
  return browserSearchCache.read(mode, key, requestedPage);
}
