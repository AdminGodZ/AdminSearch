import assert from "node:assert/strict";
import test from "node:test";

import {
  createSearchRequestKey,
  createSearchRuntimeKey,
} from "../src/features/search/lib/request-key.ts";
import { mergeSearchResponses } from "../src/features/search/lib/response.ts";

function createPreferences(generalEngines = ["brave", "duckduckgo"]) {
  return {
    engines: {
      general: new Set(generalEngines),
      images: new Set(["brave.images"]),
      videos: new Set(["youtube"]),
      news: new Set(["reuters"]),
    },
    settings: {
      calculator: true,
      doiRewrite: false,
      hashSearch: true,
      httpMethod: "get",
      imageProxy: false,
      loadMoreCount: "20",
      selfInfo: true,
      timeZone: true,
      trackerCleaner: true,
      unitConverter: true,
    },
  };
}

function createResponse(overrides = {}) {
  return {
    query: "privacy",
    tab: "all",
    page: 1,
    requestDurationMs: 120,
    results: [],
    suggestions: ["privacy tools"],
    answers: ["answer"],
    infoboxes: [],
    providerFailures: [],
    hasMore: true,
    nextPageCursor: "first-cursor",
    ...overrides,
  };
}

test("initial request keys are canonical and include page and runtime state", () => {
  const runtimeKey = createSearchRuntimeKey(createPreferences());
  const reorderedRuntimeKey = createSearchRuntimeKey(
    createPreferences(["duckduckgo", "brave"]),
  );

  assert.equal(runtimeKey, reorderedRuntimeKey);
  assert.equal(
    createSearchRequestKey("q=privacy&tab=all", 1, runtimeKey),
    createSearchRequestKey("tab=all&q=privacy", 1, runtimeKey),
  );
  assert.notEqual(
    createSearchRequestKey("q=privacy&tab=all", 1, runtimeKey),
    createSearchRequestKey("q=privacy&tab=all", 2, runtimeKey),
  );
  assert.notEqual(
    createSearchRequestKey("q=privacy&tab=all", 1, runtimeKey),
    createSearchRequestKey("q=privacy&tab=images", 1, runtimeKey),
  );
});

test("server-seeded page aggregation matches client pagination semantics", () => {
  const first = createResponse({
    results: [
      { id: "one", kind: "web", title: "One", url: "https://one.test" },
      { id: "two", kind: "web", title: "Two", url: "https://two.test" },
    ],
  });
  const second = createResponse({
    page: 2,
    totalResults: 3,
    results: [
      {
        id: "two",
        kind: "web",
        title: "Duplicate two",
        url: "https://two.test",
      },
      {
        id: "three",
        kind: "web",
        title: "Three",
        url: "https://three.test",
      },
    ],
    suggestions: [],
    answers: [],
    hasMore: false,
    nextPageCursor: undefined,
    providerFailures: [
      { engine: "duckduckgo", reason: "CAPTCHA" },
      { engine: "brave", reason: "Too many requests" },
    ],
  });

  const merged = mergeSearchResponses(first, second);

  assert.deepEqual(
    merged.results.map((result) => result.id),
    ["one", "two", "three"],
  );
  assert.strictEqual(merged.results[0], first.results[0]);
  assert.strictEqual(merged.results[1], first.results[1]);
  assert.strictEqual(merged.results[2], second.results[1]);
  assert.equal(merged.page, 2);
  assert.equal(merged.totalResults, 3);
  assert.equal(merged.hasMore, false);
  assert.equal(merged.nextPageCursor, undefined);
  assert.equal(merged.requestDurationMs, 120);
  assert.deepEqual(merged.suggestions, ["privacy tools"]);
  assert.deepEqual(merged.answers, ["answer"]);
  assert.deepEqual(merged.providerFailures, second.providerFailures);
});

test("page aggregation merges engine consensus and reranks all loaded results", () => {
  const first = createResponse({
    results: [
      {
        id: "original",
        kind: "web",
        title: "Original",
        url: "https://original.test/article",
        engine: "google",
      },
      {
        id: "single",
        kind: "web",
        title: "Single engine",
        url: "https://single.test/article",
        engine: "startpage",
      },
    ],
  });
  const second = createResponse({
    page: 2,
    results: [
      {
        id: "duplicate-original",
        kind: "web",
        title: "Duplicate original",
        url: "https://original.test/article",
        engines: ["brave", "duckduckgo"],
      },
      {
        id: "two-engines",
        kind: "web",
        title: "Two engines",
        url: "https://two.test/article",
        engines: ["google", "brave"],
      },
    ],
  });

  const merged = mergeSearchResponses(first, second);

  assert.deepEqual(
    merged.results.map((result) => result.id),
    ["original", "two-engines", "single"],
  );
  assert.deepEqual(merged.results[0].engines, [
    "google",
    "brave",
    "duckduckgo",
  ]);
});
