import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OVERVIEW_MAX_RESULTS,
  buildAiOverviewSources,
  createAiOverviewRequestBody,
  normalizeAiOverviewRequest,
  readAiOverviewText,
} from "../src/features/search/lib/ai-overview.ts";

function result(index, overrides = {}) {
  return {
    id: String(index),
    kind: "web",
    title: `Result ${index}`,
    snippet: `Snippet ${index}`,
    url: `https://example.com/${index}`,
    ...overrides,
  };
}

test("AI overview source selection keeps only the first 24 safe web results", () => {
  const results = [
    result("image", { kind: "image" }),
    result("unsafe", { url: "javascript:alert(1)" }),
    ...Array.from({ length: 30 }, (_, index) => result(index)),
  ];
  const sources = buildAiOverviewSources(results);

  assert.equal(sources.length, AI_OVERVIEW_MAX_RESULTS);
  assert.equal(sources[0].title, "Result 0");
  assert.equal(sources.at(-1).title, "Result 23");
  assert.ok(sources.every((source) => source.url.startsWith("https://")));
  assert.ok(
    new TextEncoder().encode(
      createAiOverviewRequestBody("privacy search", results),
    ).byteLength <=
      64 * 1024,
  );
});

test("AI overview requests reject malformed, oversized, and unsafe payloads", () => {
  const valid = {
    query: "privacy search",
    results: [
      {
        title: "Result",
        content: "A bounded public search-result snippet.",
        url: "https://example.com/result",
      },
    ],
  };

  assert.deepEqual(normalizeAiOverviewRequest(valid), valid);
  assert.equal(
    normalizeAiOverviewRequest({
      ...valid,
      results: Array.from({ length: 25 }, () => valid.results[0]),
    }),
    undefined,
  );
  assert.equal(
    normalizeAiOverviewRequest({
      ...valid,
      results: [{ ...valid.results[0], url: "file:///etc/passwd" }],
    }),
    undefined,
  );
  assert.equal(
    normalizeAiOverviewRequest({ ...valid, query: "q".repeat(513) }),
    undefined,
  );
});

test("AI overview responses consume plain text and never external HTML", () => {
  assert.equal(
    readAiOverviewText({ text: "  A generated overview.  " }),
    "A generated overview.",
  );
  assert.equal(
    readAiOverviewText({ html: "<script>alert('unsafe')</script>" }),
    undefined,
  );
  assert.equal(readAiOverviewText({ text: "   " }), undefined);
});
