import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeSearxResultPage,
  createSearxPaginationState,
} from "../src/features/search/server/search-pagination.ts";

function createResults(start, count) {
  return Array.from({ length: count }, (_, index) => ({
    title: `Result ${start + index}`,
    url: `https://example.test/${start + index}`,
  }));
}

function resultNumbers(results) {
  return results.map((result) => Number(new URL(result.url).pathname.slice(1)));
}

test("continuation pagination never refetches previously consumed upstream pages", async () => {
  const fetchedPages = [];
  const fetchPage = async (page) => {
    fetchedPages.push(page);

    return {
      number_of_results: 80,
      results: createResults((page - 1) * 20 + 1, 20),
    };
  };

  const first = await consumeSearxResultPage({
    fetchPage,
    maxUpstreamPages: 12,
    resultsPerPage: 20,
    state: createSearxPaginationState(),
  });

  assert.deepEqual(
    resultNumbers(first.results),
    createResults(1, 20).map((_, i) => i + 1),
  );
  assert.deepEqual(fetchedPages, [1]);
  assert.equal(first.hasMore, true);

  const second = await consumeSearxResultPage({
    fetchPage,
    maxUpstreamPages: 12,
    resultsPerPage: 20,
    state: first.state,
  });

  assert.deepEqual(
    resultNumbers(second.results),
    createResults(21, 20).map((_, i) => i + 21),
  );
  assert.deepEqual(fetchedPages, [1, 2]);
  assert.equal(second.hasMore, true);

  await consumeSearxResultPage({
    fetchPage,
    maxUpstreamPages: 12,
    resultsPerPage: 20,
    state: second.state,
  });

  assert.deepEqual(fetchedPages, [1, 2, 3]);
});

test("advancing directly to a later UI page remains linear", async () => {
  const fetchedPages = [];
  const fetchPage = async (page) => {
    fetchedPages.push(page);

    return {
      number_of_results: 120,
      results: createResults((page - 1) * 10 + 1, 10),
    };
  };
  let state = createSearxPaginationState();
  let page;

  for (let requestedPage = 1; requestedPage <= 3; requestedPage += 1) {
    page = await consumeSearxResultPage({
      fetchPage,
      maxUpstreamPages: 12,
      resultsPerPage: 10,
      state,
    });
    state = page.state;
  }

  assert.deepEqual(
    resultNumbers(page.results),
    createResults(21, 10).map((_, i) => i + 21),
  );
  assert.deepEqual(fetchedPages, [1, 2, 3]);
});

test("consuming a page does not mutate the cursor state used by retries", async () => {
  const initialState = createSearxPaginationState();
  const snapshot = structuredClone(initialState);
  const fetchPage = async (page) => ({
    number_of_results: 40,
    results: createResults((page - 1) * 20 + 1, 20),
  });

  const firstAttempt = await consumeSearxResultPage({
    fetchPage,
    maxUpstreamPages: 12,
    resultsPerPage: 20,
    state: initialState,
  });
  const retry = await consumeSearxResultPage({
    fetchPage,
    maxUpstreamPages: 12,
    resultsPerPage: 20,
    state: initialState,
  });

  assert.deepEqual(initialState, snapshot);
  assert.deepEqual(retry.results, firstAttempt.results);
  assert.deepEqual(retry.state, firstAttempt.state);
});

test("unresponsive engine metadata is retained when an upstream page is empty", async () => {
  const page = await consumeSearxResultPage({
    fetchPage: async () => ({
      results: [],
      unresponsive_engines: [
        ["duckduckgo", "CAPTCHA"],
        ["brave", "Too many requests"],
      ],
    }),
    maxUpstreamPages: 12,
    resultsPerPage: 20,
    state: createSearxPaginationState(),
  });

  assert.deepEqual(page.results, []);
  assert.deepEqual(page.unresponsiveEngines, [
    ["duckduckgo", "CAPTCHA"],
    ["brave", "Too many requests"],
  ]);
  assert.equal(page.hasMore, false);
});

test("duplicate-only upstream pages do not hide unique results on later pages", async () => {
  const fetchedPages = [];
  const pages = new Map([
    [1, createResults(1, 2)],
    [2, [createResults(2, 1)[0], createResults(3, 1)[0]]],
    [3, createResults(1, 2)],
    [4, createResults(4, 2)],
  ]);
  const fetchPage = async (page) => {
    fetchedPages.push(page);

    return {
      results: pages.get(page) ?? [],
    };
  };

  const first = await consumeSearxResultPage({
    fetchPage,
    maxUpstreamPages: 4,
    resultsPerPage: 2,
    state: createSearxPaginationState(),
  });
  const second = await consumeSearxResultPage({
    fetchPage,
    maxUpstreamPages: 4,
    resultsPerPage: 2,
    state: first.state,
  });

  assert.deepEqual(resultNumbers(first.results), [1, 2]);
  assert.deepEqual(resultNumbers(second.results), [3, 4]);
  assert.deepEqual(fetchedPages, [1, 2, 3, 4]);
  assert.equal(second.hasMore, true);
});

test("one-fetch pages retain overflow for video-style continuations", async () => {
  const fetchedPages = [];
  const fetchPage = async (page) => {
    fetchedPages.push(page);

    return {
      results: createResults((page - 1) * 15 + 1, 15),
    };
  };
  const first = await consumeSearxResultPage({
    fetchPage,
    maxPageFetches: 1,
    maxUpstreamPages: 12,
    resultsPerPage: 10,
    state: createSearxPaginationState(),
  });
  const second = await consumeSearxResultPage({
    fetchPage,
    maxPageFetches: 1,
    maxUpstreamPages: 12,
    resultsPerPage: 10,
    state: first.state,
  });

  assert.deepEqual(
    resultNumbers(first.results),
    createResults(1, 10).map((_, i) => i + 1),
  );
  assert.deepEqual(
    resultNumbers(second.results),
    createResults(11, 10).map((_, i) => i + 11),
  );
  assert.deepEqual(fetchedPages, [1, 2]);
  assert.equal(second.hasMore, true);
});

for (const resultsPerPage of [20, 40]) {
  test(`pages 1 through 12 consume each upstream page once at ${resultsPerPage} results per page`, async () => {
    const fetchedPages = [];
    const fetchPage = async (page) => {
      fetchedPages.push(page);

      return {
        number_of_results: resultsPerPage * 12,
        results: createResults((page - 1) * resultsPerPage + 1, resultsPerPage),
      };
    };
    let state = createSearxPaginationState();

    for (let clientPage = 1; clientPage <= 12; clientPage += 1) {
      const page = await consumeSearxResultPage({
        fetchPage,
        maxUpstreamPages: 12,
        resultsPerPage,
        state,
      });
      const expectedStart = (clientPage - 1) * resultsPerPage + 1;

      assert.equal(resultNumbers(page.results)[0], expectedStart);
      assert.equal(page.results.length, resultsPerPage);
      assert.equal(page.hasMore, clientPage < 12);
      state = page.state;
    }

    assert.deepEqual(
      fetchedPages,
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
  });
}
