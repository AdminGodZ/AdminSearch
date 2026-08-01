import assert from "node:assert/strict";
import test from "node:test";

import {
  createSearchResultCache,
  SEARCH_CACHE_TTL_MS,
} from "../src/features/search/lib/search-result-cache.ts";

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.calls = [];
  }

  getItem(key) {
    this.calls.push(["get", key]);
    return this.values.get(key) ?? null;
  }

  removeItem(key) {
    this.calls.push(["remove", key]);
    this.values.delete(key);
  }

  setItem(key, value) {
    this.calls.push(["set", key]);
    this.values.set(key, value);
  }
}

function createResponse(overrides = {}) {
  return {
    query: "privacy",
    tab: "all",
    page: 1,
    results: [],
    suggestions: [],
    answers: [],
    infoboxes: [],
    hasMore: true,
    nextPageCursor: "next-cursor",
    ...overrides,
  };
}

function getStoredIndex(storage) {
  const indexValue = [...storage.values.entries()].find(([key]) =>
    key.endsWith(":index"),
  )?.[1];

  return indexValue ? JSON.parse(indexValue) : undefined;
}

test("fresh mode never reads, serializes, schedules, or writes result cache data", () => {
  const storage = new MemoryStorage();
  const scheduled = [];
  const cache = createSearchResultCache({
    storage,
    schedulePersistence: (callback) => scheduled.push(callback),
  });
  const response = createResponse();

  Object.defineProperty(response, "toJSON", {
    value() {
      throw new Error("Fresh results must not be serialized");
    },
  });

  cache.write("fresh", "fresh-key", response);
  assert.equal(cache.read("fresh", "fresh-key", 1), undefined);
  assert.equal(scheduled.length, 0);
  assert.deepEqual(storage.calls, []);
});

test("cache writes are deferred, coalesced, and restored across instances", () => {
  const storage = new MemoryStorage();
  const scheduled = [];
  const cache = createSearchResultCache({
    storage,
    schedulePersistence: (callback) => scheduled.push(callback),
  });

  cache.write("cache", "privacy-key", createResponse());
  cache.write(
    "cache",
    "privacy-key",
    createResponse({ page: 2, hasMore: false }),
  );

  assert.equal(scheduled.length, 1);
  assert.equal(
    storage.calls.some(([operation]) => operation === "set"),
    false,
  );

  scheduled.shift()?.();

  const restoredCache = createSearchResultCache({ storage });
  const restored = restoredCache.read("cache", "privacy-key", 2);

  assert.equal(restored?.page, 2);
  assert.equal(restored?.hasMore, false);
  assert.equal(getStoredIndex(storage)?.entries.length, 1);
});

test("incremental updates serialize only the changed result entry", () => {
  const storage = new MemoryStorage();
  const cache = createSearchResultCache({ storage });

  cache.write("cache", "first-key", createResponse({ query: "first" }));
  cache.write("cache", "second-key", createResponse({ query: "second" }));
  storage.calls.length = 0;

  cache.write(
    "cache",
    "first-key",
    createResponse({ query: "first", page: 2 }),
  );

  const entryWrites = storage.calls.filter(
    ([operation, key]) => operation === "set" && key.includes(":entry:"),
  );

  assert.equal(entryWrites.length, 1);
  assert.match(entryWrites[0][1], /first-key/u);
});

test("expired and oldest entries are removed from bounded storage", () => {
  let currentTime = 1_000;
  const storage = new MemoryStorage();
  const cache = createSearchResultCache({
    maxEntries: 2,
    now: () => currentTime,
    storage,
  });

  cache.write("cache", "first-key", createResponse({ query: "first" }));
  currentTime += 1;
  cache.write("cache", "second-key", createResponse({ query: "second" }));
  currentTime += 1;
  cache.write("cache", "third-key", createResponse({ query: "third" }));

  assert.deepEqual(
    getStoredIndex(storage)?.entries.map((entry) => entry.key),
    ["third-key", "second-key"],
  );

  currentTime += SEARCH_CACHE_TTL_MS + 1;
  const expiredCache = createSearchResultCache({
    maxEntries: 2,
    now: () => currentTime,
    storage,
  });

  assert.equal(expiredCache.read("cache", "third-key", 1), undefined);
  assert.equal(getStoredIndex(storage), undefined);
  assert.equal(
    [...storage.values.keys()].some((key) => key.includes(":entry:")),
    false,
  );
});

test("the serialized byte budget evicts the oldest stored entry", () => {
  const storage = new MemoryStorage();
  const cache = createSearchResultCache({
    byteLength: () => 70,
    maxBytes: 100,
    storage,
  });

  cache.write("cache", "first-key", createResponse({ query: "first" }));
  cache.write("cache", "second-key", createResponse({ query: "second" }));

  assert.deepEqual(
    getStoredIndex(storage)?.entries.map((entry) => entry.key),
    ["second-key"],
  );
  assert.equal(
    [...storage.values.keys()].some((key) => key.endsWith("first-key")),
    false,
  );
});

test("stored entries that do not match their bounded index are discarded", () => {
  const storage = new MemoryStorage();
  const cache = createSearchResultCache({ storage });

  cache.write("cache", "privacy-key", createResponse());

  const entryKey = [...storage.values.keys()].find((key) =>
    key.includes(":entry:"),
  );
  assert.ok(entryKey);
  storage.values.set(entryKey, `${storage.values.get(entryKey)} `);

  const restoredCache = createSearchResultCache({ storage });

  assert.equal(restoredCache.read("cache", "privacy-key", 1), undefined);
  assert.equal(storage.values.has(entryKey), false);
});

test("oversized entries stay memory-only and quota failures are not retried", () => {
  const oversizedStorage = new MemoryStorage();
  const oversizedCache = createSearchResultCache({
    byteLength: (value) => value.length,
    maxBytes: 100,
    storage: oversizedStorage,
  });
  const oversizedResponse = createResponse({
    results: [
      {
        id: "large",
        kind: "web",
        title: "x".repeat(200),
        url: "https://example.test",
      },
    ],
  });

  oversizedCache.write("cache", "large-key", oversizedResponse);

  assert.equal(oversizedCache.read("cache", "large-key", 1), oversizedResponse);
  assert.equal(getStoredIndex(oversizedStorage), undefined);

  const quotaStorage = new MemoryStorage();
  let entryAttempts = 0;
  quotaStorage.setItem = (key, value) => {
    quotaStorage.calls.push(["set", key]);
    if (key.includes(":entry:")) {
      entryAttempts += 1;
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    }
    quotaStorage.values.set(key, value);
  };
  const quotaCache = createSearchResultCache({ storage: quotaStorage });

  quotaCache.write("cache", "quota-key", createResponse());

  assert.equal(entryAttempts, 1);
  assert.equal(getStoredIndex(quotaStorage), undefined);
});
