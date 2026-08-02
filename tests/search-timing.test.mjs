import assert from "node:assert/strict";
import test from "node:test";

import {
  createSearchJsonResponse,
  createSearchTiming,
  createSearchTimingHeaders,
} from "../src/features/search/server/search-timing.ts";
import { createClientClosedResponse } from "../src/server/upstream-fetch.ts";

function createClock(initialValue = 0) {
  let value = initialValue;

  return {
    advance(durationMs) {
      value += durationMs;
    },
    now() {
      return value;
    },
  };
}

test("successful search timing reports bounded phases and upstream requests", async () => {
  const clock = createClock();
  const timing = createSearchTiming(clock.now);

  await timing.measureAsync("prepare", async () => clock.advance(2));
  await timing.measureAsync("rate-limit", async () => clock.advance(3));
  await timing.measureAsync("prepare", async () => clock.advance(4));
  await timing.measureAsync("upstream", async () => {
    timing.recordUpstreamRequest();
    timing.recordUpstreamRequest();
    clock.advance(12);
  });
  timing.measureSync("transform", () => clock.advance(1.25));
  timing.finishService();

  clock.advance(100);
  timing.finishService();

  const payload = {
    clientIp: "203.0.113.42",
    engineToken: "private-engine-token",
    query: "private search text",
    results: [],
  };
  const response = createSearchJsonResponse({
    headers: {
      "x-ratelimit-remaining": "29",
    },
    payload,
    status: 200,
    timing,
  });
  const serverTiming = response.headers.get("server-timing");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.equal(response.headers.get("x-ratelimit-remaining"), "29");
  assert.deepEqual(await response.json(), payload);
  assert.equal(
    serverTiming,
    'rate-limit;dur=3, prepare;dur=6, upstream;dur=12;desc="requests=2", transform;dur=1.25, total;dur=22.25, serialize;dur=0',
  );
  for (const privateValue of [
    payload.clientIp,
    payload.engineToken,
    payload.query,
  ]) {
    assert.equal(serverTiming?.includes(privateValue), false);
  }
});

test("error timing exposes only phases reached before the response", async () => {
  const clock = createClock();
  const timing = createSearchTiming(clock.now);

  await assert.rejects(
    timing.measureAsync("upstream", async () => {
      timing.recordUpstreamRequest();
      clock.advance(8_000);
      throw new DOMException("Upstream timed out", "TimeoutError");
    }),
    (error) => error instanceof Error && error.name === "TimeoutError",
  );
  timing.finishService();

  const headers = createSearchTimingHeaders(
    {
      "x-ratelimit-remaining": "28",
    },
    timing,
  );
  const serverTiming = headers.get("server-timing");

  assert.equal(headers.get("x-ratelimit-remaining"), "28");
  assert.equal(
    serverTiming,
    'upstream;dur=8000;desc="requests=1", total;dur=8000',
  );
  assert.equal(serverTiming?.includes("transform"), false);
  assert.equal(serverTiming?.includes("serialize"), false);
});

test("client-aborted responses keep partial timing and remain bodyless", async () => {
  const clock = createClock();
  const timing = createSearchTiming(clock.now);
  const reason = new DOMException("Client disconnected", "AbortError");

  await timing.measureAsync("prepare", async () => clock.advance(1));
  await assert.rejects(
    timing.measureAsync("upstream", async () => {
      timing.recordUpstreamRequest();
      clock.advance(5);
      throw reason;
    }),
    (error) => error === reason,
  );
  timing.finishService();

  const response = createClientClosedResponse(
    createSearchTimingHeaders(undefined, timing),
  );
  const serverTiming = response.headers.get("server-timing");

  assert.equal(response.status, 499);
  assert.equal(await response.text(), "");
  assert.equal(
    serverTiming,
    'prepare;dur=1, upstream;dur=5;desc="requests=1", total;dur=6',
  );
  assert.equal(serverTiming?.includes("transform"), false);
  assert.equal(serverTiming?.includes("serialize"), false);
});

test("validation and rate-limit paths omit upstream-only metrics", async () => {
  const clock = createClock();
  const timing = createSearchTiming(clock.now);

  await timing.measureAsync("prepare", async () => clock.advance(1.5));
  await timing.measureAsync("rate-limit", async () => clock.advance(0.5));
  timing.finishService();

  const response = createSearchJsonResponse({
    headers: {},
    payload: { message: "Invalid search parameters." },
    status: 400,
    timing,
  });
  const serverTiming = response.headers.get("server-timing");

  assert.equal(
    serverTiming,
    "rate-limit;dur=0.5, prepare;dur=1.5, total;dur=2, serialize;dur=0",
  );
  assert.equal(serverTiming?.includes("upstream"), false);
  assert.equal(serverTiming?.includes("transform"), false);
});

test("unstarted and invalid timing values never leak invalid header data", () => {
  const emptyTiming = createSearchTiming(() => Number.NaN);
  const emptyHeaders = createSearchTimingHeaders(undefined, emptyTiming);

  assert.equal(emptyHeaders.has("server-timing"), false);

  const values = [10, 9, 8, Number.POSITIVE_INFINITY];
  const timing = createSearchTiming(() => values.shift() ?? 0);
  timing.measureSync("prepare", () => undefined);
  timing.finishService();

  const serverTiming = createSearchTimingHeaders(undefined, timing).get(
    "server-timing",
  );

  assert.equal(serverTiming, "prepare;dur=0, total;dur=0");
  assert.equal(serverTiming?.includes("NaN"), false);
  assert.equal(serverTiming?.includes("Infinity"), false);
  assert.equal(serverTiming?.includes("-"), false);
});
