import assert from "node:assert/strict";
import test from "node:test";

import {
  createSearxngVersionClient,
  INITIAL_SEARXNG_VERSION_STATUS,
  SEARXNG_VERSION_RETRY_DELAYS_MS,
} from "../src/features/maintenance/lib/searxng-version-client.ts";
import { getSearxngVersionCacheControl } from "../src/features/maintenance/lib/searxng-version-policy.ts";

function createFakeScheduler() {
  let nextId = 1;
  const scheduledDelays = [];
  const tasks = [];

  return {
    scheduler: {
      clearTimeout(id) {
        const task = tasks.find((candidate) => candidate.id === id);

        if (task) {
          task.active = false;
        }
      },
      setTimeout(callback, delayMs) {
        const task = {
          active: true,
          callback,
          delayMs,
          id: nextId,
        };

        nextId += 1;
        scheduledDelays.push(delayMs);
        tasks.push(task);

        return task.id;
      },
    },
    getPendingTasks() {
      return tasks.filter((task) => task.active);
    },
    async runNextTask() {
      const task = tasks.find((candidate) => candidate.active);

      assert.ok(task, "Expected a pending retry");
      task.active = false;
      await task.callback();
    },
    scheduledDelays,
  };
}

test("version checks use normal HTTP caching and stop after a known result", async () => {
  const fetchCalls = [];
  const statuses = [];
  const fakeScheduler = createFakeScheduler();
  const client = createSearxngVersionClient({
    fetcher: async (input, init) => {
      fetchCalls.push({ input, init });

      return Response.json({
        currentVersion: " 2026.8.0 ",
        latestVersion: "2026.8.0",
        state: "latest",
      });
    },
    onStatus: (status) => statuses.push(status),
    scheduler: fakeScheduler.scheduler,
  });

  await client.start();

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].input, "/api/searxng/version");
  assert.equal(fetchCalls[0].init.cache, "default");
  assert.equal(fetchCalls[0].init.signal.aborted, false);
  assert.deepEqual(statuses, [
    {
      currentVersion: "2026.8.0",
      latestVersion: "2026.8.0",
      state: "latest",
    },
  ]);
  assert.equal(fakeScheduler.getPendingTasks().length, 0);

  client.stop();
  assert.equal(fetchCalls[0].init.signal.aborted, true);
});

test("unknown results use the bounded retry schedule and stop after four attempts", async () => {
  let requestCount = 0;
  const statuses = [];
  const fakeScheduler = createFakeScheduler();
  const client = createSearxngVersionClient({
    fetcher: async () => {
      requestCount += 1;
      return new Response(null, { status: 503 });
    },
    onStatus: (status) => statuses.push(status),
    scheduler: fakeScheduler.scheduler,
  });

  await client.start();

  for (const expectedDelay of SEARXNG_VERSION_RETRY_DELAYS_MS) {
    assert.deepEqual(
      fakeScheduler.getPendingTasks().map((task) => task.delayMs),
      [expectedDelay],
    );
    await fakeScheduler.runNextTask();
  }

  assert.equal(requestCount, 4);
  assert.deepEqual(fakeScheduler.scheduledDelays, [15_000, 60_000, 300_000]);
  assert.equal(fakeScheduler.getPendingTasks().length, 0);
  assert.deepEqual(
    statuses,
    Array.from({ length: 4 }, () => INITIAL_SEARXNG_VERSION_STATUS),
  );

  client.stop();
});

test("a successful retry prevents later retries", async () => {
  let requestCount = 0;
  const statuses = [];
  const fakeScheduler = createFakeScheduler();
  const client = createSearxngVersionClient({
    fetcher: async () => {
      requestCount += 1;

      if (requestCount === 1) {
        return new Response(null, { status: 503 });
      }

      return Response.json({
        currentVersion: "2026.8.0",
        latestVersion: "2026.8.1",
        state: "outdated",
      });
    },
    onStatus: (status) => statuses.push(status),
    scheduler: fakeScheduler.scheduler,
  });

  await client.start();
  await fakeScheduler.runNextTask();

  assert.equal(requestCount, 2);
  assert.deepEqual(
    statuses.map((status) => status.state),
    ["unknown", "outdated"],
  );
  assert.equal(fakeScheduler.getPendingTasks().length, 0);

  client.stop();
});

test("stopping a version client aborts its request and clears its retry", async () => {
  let requestCount = 0;
  let requestSignal;
  const fakeScheduler = createFakeScheduler();
  const client = createSearxngVersionClient({
    fetcher: async (_input, init) => {
      requestCount += 1;
      requestSignal = init?.signal;
      return new Response(null, { status: 503 });
    },
    onStatus() {},
    scheduler: fakeScheduler.scheduler,
  });

  await client.start();
  assert.equal(fakeScheduler.getPendingTasks().length, 1);

  client.stop();

  assert.equal(requestSignal?.aborted, true);
  assert.equal(fakeScheduler.getPendingTasks().length, 0);
  assert.equal(requestCount, 1);
});

test("stopping during an active version check suppresses updates and retries", async () => {
  let requestSignal;
  const statuses = [];
  const fakeScheduler = createFakeScheduler();
  const client = createSearxngVersionClient({
    fetcher: (_input, init) => {
      requestSignal = init?.signal;

      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener(
          "abort",
          () => reject(requestSignal.reason),
          { once: true },
        );
      });
    },
    onStatus: (status) => statuses.push(status),
    scheduler: fakeScheduler.scheduler,
  });

  const start = client.start();
  client.stop();
  await start;

  assert.equal(requestSignal?.aborted, true);
  assert.deepEqual(statuses, []);
  assert.equal(fakeScheduler.getPendingTasks().length, 0);
});

test("the route cache policy caches known states but not unknown failures", () => {
  const successCacheControl =
    "public, max-age=300, stale-while-revalidate=3600";

  assert.equal(getSearxngVersionCacheControl("latest"), successCacheControl);
  assert.equal(getSearxngVersionCacheControl("outdated"), successCacheControl);
  assert.equal(getSearxngVersionCacheControl("unknown"), "no-store");
});
