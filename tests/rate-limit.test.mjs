import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const sourceRoot = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(
        new URL(`${specifier.slice(2)}.ts`, sourceRoot).href,
        context,
      );
    }

    return nextResolve(specifier, context);
  },
});

const { checkRateLimit: defaultCheckRateLimit, ...rateLimitModule } =
  await import("../src/server/rate-limit.ts");
const { createRateLimitChecker, createRateLimitHeaders } = rateLimitModule;

// Keep the production singleton imported so this test also catches module setup errors.
assert.equal(typeof defaultCheckRateLimit, "function");

test("Redis-backed checks use one atomic command and preserve result semantics", async () => {
  const calls = [];
  const responses = [
    [1, 5_000],
    [2, 4_900],
    [3, 4_800],
  ];
  const redis = {
    async adminsearchRateLimit(...args) {
      calls.push(args);
      return responses.shift();
    },
  };
  const checkRateLimit = createRateLimitChecker(
    () => redis,
    () => 10_000,
  );
  const options = { maxRequests: 2, windowMs: 5_000 };

  assert.deepEqual(await checkRateLimit("client", options), {
    allowed: true,
    limit: 2,
    remaining: 1,
    resetAt: 15_000,
  });
  assert.deepEqual(await checkRateLimit("client", options), {
    allowed: true,
    limit: 2,
    remaining: 0,
    resetAt: 14_900,
  });
  assert.deepEqual(await checkRateLimit("client", options), {
    allowed: false,
    limit: 2,
    remaining: 0,
    resetAt: 14_800,
  });
  assert.deepEqual(calls, [
    ["adminsearch:ratelimit:client", 5_000],
    ["adminsearch:ratelimit:client", 5_000],
    ["adminsearch:ratelimit:client", 5_000],
  ]);
});

test("Redis failures retain the bounded memory fallback and window reset", async () => {
  let currentTime = 20_000;
  let redisAttempts = 0;
  const redis = {
    async adminsearchRateLimit() {
      redisAttempts += 1;
      throw new Error("Redis unavailable");
    },
  };
  const checkRateLimit = createRateLimitChecker(
    () => redis,
    () => currentTime,
  );
  const options = { maxRequests: 2, windowMs: 1_000 };
  const key = `fallback-${crypto.randomUUID()}`;

  assert.deepEqual(await checkRateLimit(key, options), {
    allowed: true,
    limit: 2,
    remaining: 1,
    resetAt: 21_000,
  });
  assert.deepEqual(await checkRateLimit(key, options), {
    allowed: true,
    limit: 2,
    remaining: 0,
    resetAt: 21_000,
  });
  assert.deepEqual(await checkRateLimit(key, options), {
    allowed: false,
    limit: 2,
    remaining: 0,
    resetAt: 21_000,
  });

  currentTime = 21_000;

  assert.deepEqual(await checkRateLimit(key, options), {
    allowed: true,
    limit: 2,
    remaining: 1,
    resetAt: 22_000,
  });
  assert.equal(redisAttempts, 4);
});

test("missing Redis configuration uses the same memory limiter", async () => {
  const checkRateLimit = createRateLimitChecker(
    () => null,
    () => 30_000,
  );
  const result = await checkRateLimit(`memory-${crypto.randomUUID()}`, {
    maxRequests: 5,
    windowMs: 2_000,
  });

  assert.deepEqual(result, {
    allowed: true,
    limit: 5,
    remaining: 4,
    resetAt: 32_000,
  });
});

test("rate-limit headers retain their exact wire format", () => {
  assert.deepEqual(
    createRateLimitHeaders({
      allowed: true,
      limit: 30,
      remaining: 29,
      resetAt: 123_456,
    }),
    {
      "x-ratelimit-limit": "30",
      "x-ratelimit-remaining": "29",
      "x-ratelimit-reset": "123456",
    },
  );
});
