import assert from "node:assert/strict";
import test from "node:test";

import {
  createFaviconCache,
  normalizeFaviconAuthority,
  normalizeFaviconContentType,
  resolveFaviconResolver,
} from "../src/features/search/server/favicon-cache.ts";

function faviconPayload(size = 8, contentType = "image/png") {
  return {
    body: new ArrayBuffer(size),
    contentType,
  };
}

test("explicit favicon resolvers skip preference loading", async () => {
  let preferenceReads = 0;
  const loadPreference = async () => {
    preferenceReads += 1;
    return "duckduckgo";
  };

  assert.equal(
    await resolveFaviconResolver("google", loadPreference),
    "google",
  );
  assert.equal(preferenceReads, 0);
  assert.equal(
    await resolveFaviconResolver(null, loadPreference),
    "duckduckgo",
  );
  assert.equal(preferenceReads, 1);
});

test("favicon inputs retain authority and image content validation", () => {
  assert.equal(normalizeFaviconAuthority(" Example.COM "), "example.com");
  assert.equal(normalizeFaviconAuthority("example.com/path"), undefined);
  assert.equal(normalizeFaviconAuthority("example.com\\path"), undefined);
  assert.equal(normalizeFaviconAuthority(`example.com\n.test`), undefined);
  assert.equal(normalizeFaviconContentType("image/png"), "image/png");
  assert.equal(
    normalizeFaviconContentType("image/svg+xml; charset=utf-8"),
    "image/svg+xml; charset=utf-8",
  );
  assert.equal(normalizeFaviconContentType("text/html"), undefined);
  assert.equal(normalizeFaviconContentType(null), undefined);
});

test("favicon cache deduplicates in-flight loads and reuses successes", async () => {
  const cache = createFaviconCache({
    maxBytes: 1024,
    maxEntries: 4,
    negativeTtlMs: 100,
    successTtlMs: 1_000,
  });
  let loads = 0;
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const load = async () => {
    loads += 1;
    await pending;
    return faviconPayload();
  };
  const first = cache.getOrLoad("google:example.com", load);
  const second = cache.getOrLoad("google:example.com", load);

  release();

  assert.strictEqual(await first, await second);
  assert.equal(loads, 1);
  assert.strictEqual(
    await cache.getOrLoad("google:example.com", load),
    await first,
  );
  assert.equal(loads, 1);
});

test("favicon cache expires negative entries sooner than successes", async () => {
  let currentTime = 0;
  const cache = createFaviconCache({
    maxBytes: 1024,
    maxEntries: 4,
    negativeTtlMs: 100,
    now: () => currentTime,
    successTtlMs: 1_000,
  });
  let negativeLoads = 0;
  let successLoads = 0;

  await cache.getOrLoad("missing", async () => {
    negativeLoads += 1;
    return null;
  });
  const success = await cache.getOrLoad("present", async () => {
    successLoads += 1;
    return faviconPayload();
  });

  currentTime = 100;

  await cache.getOrLoad("missing", async () => {
    negativeLoads += 1;
    return null;
  });
  assert.strictEqual(
    await cache.getOrLoad("present", async () => {
      successLoads += 1;
      return faviconPayload();
    }),
    success,
  );
  assert.equal(negativeLoads, 2);
  assert.equal(successLoads, 1);
});

test("favicon cache evicts least-recently-used and oversized entries", async () => {
  const cache = createFaviconCache({
    maxBytes: 16,
    maxEntries: 2,
    negativeTtlMs: 100,
    successTtlMs: 1_000,
  });
  const loads = new Map();
  const load = (key, size = 8) =>
    cache.getOrLoad(key, async () => {
      loads.set(key, (loads.get(key) ?? 0) + 1);
      return faviconPayload(size);
    });

  await load("a");
  await load("b");
  await load("a");
  await load("c");
  await load("b");
  await load("oversized", 32);
  await load("oversized", 32);

  assert.equal(loads.get("a"), 1);
  assert.equal(loads.get("b"), 2);
  assert.equal(loads.get("oversized"), 2);
});
