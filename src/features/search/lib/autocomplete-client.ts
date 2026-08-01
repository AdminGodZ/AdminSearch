export const AUTOCOMPLETE_DEBOUNCE_MS = 80;
export const AUTOCOMPLETE_CACHE_TTL_MS = 2 * 60_000;
export const AUTOCOMPLETE_CACHE_MAX_ENTRIES = 40;

type AutocompleteFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type AutocompleteClientOptions = {
  cacheMaxEntries?: number;
  cacheTtlMs?: number;
  fetcher?: AutocompleteFetcher;
  maxQueryLength: number;
  maxSuggestions: number;
  minQueryLength: number;
  now?: () => number;
};

type CachedSuggestions = {
  expiresAt: number;
  suggestions: string[];
};

type InFlightRequest = {
  controller: AbortController;
  promise: Promise<string[]>;
  settled: boolean;
  subscribers: Set<symbol>;
};

export function normalizeAutocompleteQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

function createQueryKey(query: string) {
  return normalizeAutocompleteQuery(query).toLowerCase();
}

function parseSuggestions(payload: unknown, maxSuggestions: number) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("suggestions" in payload) ||
    !Array.isArray(payload.suggestions)
  ) {
    return [];
  }

  return payload.suggestions
    .filter(
      (item): item is string => typeof item === "string" && item.trim() !== "",
    )
    .slice(0, maxSuggestions);
}

function getAbortReason(signal: AbortSignal) {
  return (
    signal.reason ??
    new DOMException("Autocomplete request aborted", "AbortError")
  );
}

export function createAutocompleteClient({
  cacheMaxEntries = AUTOCOMPLETE_CACHE_MAX_ENTRIES,
  cacheTtlMs = AUTOCOMPLETE_CACHE_TTL_MS,
  fetcher = (input, init) => fetch(input, init),
  maxQueryLength,
  maxSuggestions,
  minQueryLength,
  now = Date.now,
}: AutocompleteClientOptions) {
  const cache = new Map<string, CachedSuggestions>();
  const inFlightRequests = new Map<string, InFlightRequest>();

  function readCachedSuggestions(query: string) {
    const key = createQueryKey(query);
    const cached = cache.get(key);

    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt <= now()) {
      cache.delete(key);
      return undefined;
    }

    cache.delete(key);
    cache.set(key, cached);
    return [...cached.suggestions];
  }

  function writeCachedSuggestions(query: string, suggestions: string[]) {
    if (cacheMaxEntries <= 0 || suggestions.length === 0) {
      return;
    }

    const currentTime = now();

    for (const [key, cached] of cache) {
      if (cached.expiresAt <= currentTime) {
        cache.delete(key);
      }
    }

    const key = createQueryKey(query);
    cache.delete(key);
    cache.set(key, {
      expiresAt: currentTime + cacheTtlMs,
      suggestions: [...suggestions],
    });

    while (cache.size > cacheMaxEntries) {
      const oldestKey = cache.keys().next().value;

      if (oldestKey === undefined) {
        break;
      }

      cache.delete(oldestKey);
    }
  }

  async function fetchSuggestions(query: string, signal: AbortSignal) {
    const response = await fetcher(
      `/api/autocomplete?q=${encodeURIComponent(query)}`,
      {
        signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return [];
    }

    const payload: unknown = await response.json();
    const suggestions = parseSuggestions(payload, maxSuggestions);
    writeCachedSuggestions(query, suggestions);
    return suggestions;
  }

  function createInFlightRequest(query: string, key: string) {
    const controller = new AbortController();
    let entry: InFlightRequest;
    const promise = fetchSuggestions(query, controller.signal).finally(() => {
      entry.settled = true;

      if (inFlightRequests.get(key) === entry) {
        inFlightRequests.delete(key);
      }
    });

    entry = {
      controller,
      promise,
      settled: false,
      subscribers: new Set(),
    };
    inFlightRequests.set(key, entry);
    return entry;
  }

  function subscribeToRequest(
    entry: InFlightRequest,
    signal: AbortSignal | undefined,
  ) {
    const subscriber = Symbol("autocomplete-subscriber");
    entry.subscribers.add(subscriber);

    return new Promise<string[]>((resolve, reject) => {
      let finished = false;

      const release = (reason?: unknown) => {
        entry.subscribers.delete(subscriber);

        if (
          !entry.settled &&
          entry.subscribers.size === 0 &&
          !entry.controller.signal.aborted
        ) {
          entry.controller.abort(reason);
        }
      };

      const handleAbort = () => {
        if (finished || !signal) {
          return;
        }

        finished = true;
        signal.removeEventListener("abort", handleAbort);
        const reason = getAbortReason(signal);
        release(reason);
        reject(reason);
      };

      signal?.addEventListener("abort", handleAbort, { once: true });

      void entry.promise.then(
        (suggestions) => {
          if (finished) {
            return;
          }

          finished = true;
          signal?.removeEventListener("abort", handleAbort);
          release();
          resolve([...suggestions]);
        },
        (error: unknown) => {
          if (finished) {
            return;
          }

          finished = true;
          signal?.removeEventListener("abort", handleAbort);
          release(error);
          reject(error);
        },
      );
    });
  }

  function getCachedSuggestions(query: string) {
    const normalizedQuery = normalizeAutocompleteQuery(query);

    if (
      normalizedQuery.length < minQueryLength ||
      normalizedQuery.length > maxQueryLength
    ) {
      return undefined;
    }

    return readCachedSuggestions(normalizedQuery);
  }

  function requestSuggestions(query: string, signal?: AbortSignal) {
    if (signal?.aborted) {
      return Promise.reject<string[]>(getAbortReason(signal));
    }

    const normalizedQuery = normalizeAutocompleteQuery(query);

    if (
      normalizedQuery.length < minQueryLength ||
      normalizedQuery.length > maxQueryLength
    ) {
      return Promise.resolve<string[]>([]);
    }

    const cached = readCachedSuggestions(normalizedQuery);

    if (cached) {
      return Promise.resolve(cached);
    }

    const key = createQueryKey(normalizedQuery);
    let entry = inFlightRequests.get(key);

    if (!entry || entry.controller.signal.aborted) {
      entry = createInFlightRequest(normalizedQuery, key);
    }

    return subscribeToRequest(entry, signal);
  }

  return {
    getCachedSuggestions,
    requestSuggestions,
  };
}
