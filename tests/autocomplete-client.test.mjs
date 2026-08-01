import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTOCOMPLETE_DEBOUNCE_MS,
  createAutocompleteClient,
  normalizeAutocompleteQuery,
} from "../src/features/search/lib/autocomplete-client.ts";

function createTestAutocompleteClient(options = {}) {
  return createAutocompleteClient({
    maxQueryLength: 128,
    maxSuggestions: 8,
    minQueryLength: 2,
    ...options,
  });
}

test("autocomplete queries are normalized and client results stay capped", async () => {
  const requestedUrls = [];
  const client = createTestAutocompleteClient({
    fetcher: async (input) => {
      requestedUrls.push(String(input));
      return Response.json({
        suggestions: Array.from(
          { length: 10 },
          (_, index) => `suggestion ${index + 1}`,
        ),
      });
    },
  });

  assert.equal(
    normalizeAutocompleteQuery("  GooGle   search\nquery  "),
    "GooGle search query",
  );
  assert.equal(AUTOCOMPLETE_DEBOUNCE_MS, 80);

  const first = await client.requestSuggestions("  GooGle   search  ");
  const cached = await client.requestSuggestions("google search");

  assert.equal(first.length, 8);
  assert.deepEqual(cached, first);
  assert.deepEqual(requestedUrls, ["/api/autocomplete?q=GooGle%20search"]);
});

test("autocomplete cache entries expire and empty responses are not retained", async () => {
  let currentTime = 1_000;
  let requestCount = 0;
  let returnEmpty = false;
  const client = createTestAutocompleteClient({
    cacheTtlMs: 100,
    fetcher: async () => {
      requestCount += 1;
      return Response.json({
        suggestions: returnEmpty ? [] : ["privacy search"],
      });
    },
    now: () => currentTime,
  });

  await client.requestSuggestions("privacy");
  currentTime += 99;
  await client.requestSuggestions("PRIVACY");
  assert.equal(requestCount, 1);

  currentTime += 1;
  await client.requestSuggestions("privacy");
  assert.equal(requestCount, 2);

  returnEmpty = true;
  await client.requestSuggestions("no results");
  await client.requestSuggestions("no results");
  assert.equal(requestCount, 4);
});

test("autocomplete memory cache is bounded with least-recently-used eviction", async () => {
  const client = createTestAutocompleteClient({
    cacheMaxEntries: 2,
    fetcher: async (input) => Response.json({ suggestions: [String(input)] }),
  });

  await client.requestSuggestions("alpha");
  await client.requestSuggestions("bravo");
  assert.ok(client.getCachedSuggestions("alpha"));
  await client.requestSuggestions("charlie");

  assert.ok(client.getCachedSuggestions("alpha"));
  assert.equal(client.getCachedSuggestions("bravo"), undefined);
  assert.ok(client.getCachedSuggestions("charlie"));
});

test("identical in-flight autocomplete queries share one request", async () => {
  let finishFetch;
  let requestCount = 0;
  const client = createTestAutocompleteClient({
    fetcher: (_input, _init) => {
      requestCount += 1;
      return new Promise((resolve) => {
        finishFetch = resolve;
      });
    },
  });
  const first = client.requestSuggestions("Google");
  const second = client.requestSuggestions("  google  ");

  assert.equal(requestCount, 1);
  assert.ok(finishFetch);
  finishFetch(Response.json({ suggestions: ["google search"] }));

  assert.deepEqual(await first, ["google search"]);
  assert.deepEqual(await second, ["google search"]);
});

test("canceling one subscriber preserves a shared autocomplete request", async () => {
  let finishFetch;
  let upstreamSignal;
  const client = createTestAutocompleteClient({
    fetcher: (_input, init) => {
      upstreamSignal = init?.signal;
      return new Promise((resolve) => {
        finishFetch = resolve;
      });
    },
  });
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = client.requestSuggestions("privacy", firstController.signal);
  const second = client.requestSuggestions("PRIVACY", secondController.signal);
  const reason = new DOMException("First consumer left", "AbortError");

  firstController.abort(reason);

  await assert.rejects(first, (error) => error === reason);
  assert.equal(upstreamSignal?.aborted, false);
  assert.ok(finishFetch);
  finishFetch(Response.json({ suggestions: ["privacy tools"] }));
  assert.deepEqual(await second, ["privacy tools"]);
});

test("canceling the last subscriber aborts the active autocomplete request", async () => {
  let upstreamSignal;
  const client = createTestAutocompleteClient({
    fetcher: (_input, init) => {
      upstreamSignal = init?.signal;

      return new Promise((_resolve, reject) => {
        if (!upstreamSignal) {
          reject(new Error("Expected an upstream signal"));
          return;
        }

        upstreamSignal.addEventListener(
          "abort",
          () => reject(upstreamSignal?.reason),
          { once: true },
        );
      });
    },
  });
  const controller = new AbortController();
  const request = client.requestSuggestions("privacy", controller.signal);
  const reason = new DOMException("Input blurred", "AbortError");

  controller.abort(reason);

  await assert.rejects(request, (error) => error === reason);
  assert.equal(upstreamSignal?.aborted, true);
  assert.equal(upstreamSignal?.reason, reason);
});

test("invalid autocomplete lengths do not reach the API", async () => {
  let requestCount = 0;
  const client = createTestAutocompleteClient({
    fetcher: async () => {
      requestCount += 1;
      return Response.json({ suggestions: ["unexpected"] });
    },
  });

  assert.deepEqual(await client.requestSuggestions("a"), []);
  assert.deepEqual(await client.requestSuggestions("x".repeat(129)), []);
  assert.equal(requestCount, 0);
});

test("an already-canceled autocomplete consumer does not start a request", async () => {
  let requestCount = 0;
  const client = createTestAutocompleteClient({
    fetcher: async () => {
      requestCount += 1;
      return Response.json({ suggestions: ["unexpected"] });
    },
  });
  const controller = new AbortController();
  const reason = new DOMException("Already blurred", "AbortError");
  controller.abort(reason);

  await assert.rejects(
    client.requestSuggestions("privacy", controller.signal),
    (error) => error === reason,
  );
  assert.equal(requestCount, 0);
});
