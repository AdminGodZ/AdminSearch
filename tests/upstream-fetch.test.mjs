import assert from "node:assert/strict";
import test from "node:test";

import {
  createClientClosedResponse,
  fetchUpstream,
} from "../src/server/upstream-fetch.ts";

function installPendingFetch(t) {
  const originalFetch = globalThis.fetch;
  let receivedSignal;

  globalThis.fetch = (_input, init) => {
    receivedSignal = init?.signal;

    return new Promise((_resolve, reject) => {
      if (!receivedSignal) {
        reject(new Error("Expected an upstream abort signal."));
        return;
      }

      const rejectWithReason = () => reject(receivedSignal.reason);

      if (receivedSignal.aborted) {
        rejectWithReason();
        return;
      }

      receivedSignal.addEventListener("abort", rejectWithReason, {
        once: true,
      });
    });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  return () => receivedSignal;
}

test("client cancellation aborts an active upstream fetch", async (t) => {
  const getReceivedSignal = installPendingFetch(t);
  const controller = new AbortController();
  const reason = new DOMException("Client disconnected", "AbortError");
  let upstreamRequestCount = 0;
  const request = fetchUpstream(
    "https://example.test/slow",
    { method: "GET" },
    {
      onRequest: () => {
        upstreamRequestCount += 1;
      },
      requestSignal: controller.signal,
      timeoutMs: 1_000,
    },
  );

  controller.abort(reason);

  await assert.rejects(request, (error) => error === reason);
  assert.equal(getReceivedSignal()?.aborted, true);
  assert.equal(getReceivedSignal()?.reason, reason);
  assert.equal(upstreamRequestCount, 1);
});

test("upstream timeout remains active without client cancellation", async (t) => {
  const getReceivedSignal = installPendingFetch(t);
  const controller = new AbortController();
  const request = fetchUpstream(
    "https://example.test/slow",
    { method: "GET" },
    { requestSignal: controller.signal, timeoutMs: 10 },
  );

  await assert.rejects(
    request,
    (error) => error instanceof Error && error.name === "TimeoutError",
  );
  assert.equal(getReceivedSignal()?.aborted, true);
  assert.equal(getReceivedSignal()?.reason?.name, "TimeoutError");
  assert.equal(controller.signal.aborted, false);
});

test("client-closed responses are explicit and bodyless", async () => {
  const response = createClientClosedResponse({
    "x-ratelimit-remaining": "12",
  });

  assert.equal(response.status, 499);
  assert.equal(response.headers.get("x-ratelimit-remaining"), "12");
  assert.equal(await response.text(), "");
});
