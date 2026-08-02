import assert from "node:assert/strict";
import test from "node:test";

const redisUrl = process.env.RATE_LIMIT_TEST_REDIS_URL;

test("the live Valkey script is atomic, expiring, concurrent, and reloadable", {
  skip: redisUrl ? false : "RATE_LIMIT_TEST_REDIS_URL is not configured",
}, async () => {
  const { getRedisClient } = await import("../src/server/redis.ts");
  const redis = getRedisClient(redisUrl);

  assert.ok(redis);

  const keyPrefix = `adminsearch:test:ratelimit:${crypto.randomUUID()}`;
  const originalSendCommand = redis.sendCommand.bind(redis);
  const sentCommands = [];

  redis.sendCommand = (command, ...args) => {
    sentCommands.push(command.name);
    return originalSendCommand(command, ...args);
  };

  try {
    const firstKey = `${keyPrefix}:first`;
    const first = await redis.adminsearchRateLimit(firstKey, 2_000);
    const later = await redis.adminsearchRateLimit(firstKey, 2_000);

    assert.equal(first[0], 1);
    assert.ok(first[1] > 0 && first[1] <= 2_000);
    assert.equal(later[0], 2);
    assert.ok(later[1] > 0 && later[1] <= first[1]);

    sentCommands.length = 0;
    await redis.adminsearchRateLimit(firstKey, 2_000);
    assert.deepEqual(sentCommands, ["evalsha"]);

    const orphanKey = `${keyPrefix}:orphan`;
    await redis.set(orphanKey, "10");
    assert.equal(await redis.pttl(orphanKey), -1);
    const repaired = await redis.adminsearchRateLimit(orphanKey, 2_000);

    assert.equal(repaired[0], 11);
    assert.ok(repaired[1] > 0 && repaired[1] <= 2_000);
    assert.ok((await redis.pttl(orphanKey)) > 0);

    const invalidWindowKey = `${keyPrefix}:invalid-window`;

    await assert.rejects(
      redis.adminsearchRateLimit(invalidWindowKey, Number.NaN),
      /rate limit window must be a positive integer/u,
    );
    assert.equal(await redis.exists(invalidWindowKey), 0);

    const concurrentKey = `${keyPrefix}:concurrent`;
    const concurrent = await Promise.all(
      Array.from({ length: 50 }, () =>
        redis.adminsearchRateLimit(concurrentKey, 2_000),
      ),
    );

    assert.deepEqual(
      concurrent.map(([total]) => total).sort((left, right) => left - right),
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
    assert.ok((await redis.pttl(concurrentKey)) > 0);

    await redis.script("FLUSH");
    sentCommands.length = 0;
    const afterFlush = await redis.adminsearchRateLimit(firstKey, 2_000);

    assert.equal(afterFlush[0], 4);
    assert.deepEqual(sentCommands, ["evalsha", "evalsha"]);

    const expiringKey = `${keyPrefix}:expiry`;
    await redis.adminsearchRateLimit(expiringKey, 100);
    await new Promise((resolve) => setTimeout(resolve, 175));
    assert.equal(await redis.exists(expiringKey), 0);
  } finally {
    redis.sendCommand = originalSendCommand;
    await redis.del(
      `${keyPrefix}:first`,
      `${keyPrefix}:orphan`,
      `${keyPrefix}:invalid-window`,
      `${keyPrefix}:concurrent`,
      `${keyPrefix}:expiry`,
    );
    redis.disconnect();
  }
});
