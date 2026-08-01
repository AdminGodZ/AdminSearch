export type FaviconResolver = "duckduckgo" | "google";

export type FaviconPayload = {
  body: ArrayBuffer;
  contentType: string;
};

type FaviconCacheValue = FaviconPayload | null;

type FaviconCacheEntry = {
  expiresAt: number;
  size: number;
  value: FaviconCacheValue;
};

type FaviconCacheOptions = {
  maxBytes: number;
  maxEntries: number;
  negativeTtlMs: number;
  now?: () => number;
  successTtlMs: number;
};

export function normalizeFaviconAuthority(value: string | null) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();

  if (
    trimmed === "" ||
    trimmed.length > 253 ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    trimmed.includes("@") ||
    /\s/u.test(trimmed)
  ) {
    return undefined;
  }

  return trimmed;
}

export function normalizeFaviconResolver(
  value: string | null | undefined,
): FaviconResolver {
  return value === "duckduckgo" ? "duckduckgo" : "google";
}

export async function resolveFaviconResolver(
  explicitResolver: string | null,
  loadPreferredResolver: () => Promise<string | null | undefined>,
) {
  if (explicitResolver !== null) {
    return normalizeFaviconResolver(explicitResolver);
  }

  return normalizeFaviconResolver(await loadPreferredResolver());
}

export function normalizeFaviconContentType(value: string | null) {
  const contentType = value?.trim();

  return contentType?.toLowerCase().startsWith("image/")
    ? contentType
    : undefined;
}

export function createFaviconCache({
  maxBytes,
  maxEntries,
  negativeTtlMs,
  now = Date.now,
  successTtlMs,
}: FaviconCacheOptions) {
  const entries = new Map<string, FaviconCacheEntry>();
  const inFlight = new Map<string, Promise<FaviconCacheValue>>();
  let storedBytes = 0;

  function removeEntry(key: string, entry: FaviconCacheEntry) {
    entries.delete(key);
    storedBytes -= entry.size;
  }

  function pruneExpired(currentTime: number) {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= currentTime) {
        removeEntry(key, entry);
      }
    }
  }

  function read(key: string, currentTime: number) {
    const entry = entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= currentTime) {
      removeEntry(key, entry);
      return undefined;
    }

    entries.delete(key);
    entries.set(key, entry);
    return entry.value;
  }

  function write(key: string, value: FaviconCacheValue, currentTime: number) {
    const size = value?.body.byteLength ?? 0;

    if (size > maxBytes) {
      return;
    }

    pruneExpired(currentTime);

    const existing = entries.get(key);

    if (existing) {
      removeEntry(key, existing);
    }

    while (
      entries.size >= maxEntries ||
      (entries.size > 0 && storedBytes + size > maxBytes)
    ) {
      const oldest = entries.entries().next().value as
        | [string, FaviconCacheEntry]
        | undefined;

      if (!oldest) {
        break;
      }

      removeEntry(oldest[0], oldest[1]);
    }

    entries.set(key, {
      expiresAt: currentTime + (value ? successTtlMs : negativeTtlMs),
      size,
      value,
    });
    storedBytes += size;
  }

  async function getOrLoad(
    key: string,
    load: () => Promise<FaviconCacheValue>,
  ) {
    const cached = read(key, now());

    if (cached !== undefined) {
      return cached;
    }

    const pending = inFlight.get(key);

    if (pending) {
      return pending;
    }

    const request = (async () => {
      try {
        const value = await load();
        write(key, value, now());
        return value;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, request);
    return request;
  }

  return {
    getOrLoad,
  };
}
