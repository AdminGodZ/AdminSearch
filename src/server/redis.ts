import Redis from "ioredis";

const RATE_LIMIT_SCRIPT = `
local window = tonumber(ARGV[1])

if not window or window <= 0 or window % 1 ~= 0 then
  return redis.error_reply("rate limit window must be a positive integer")
end

local created = redis.call("SET", KEYS[1], 1, "PX", window, "NX")

if created then
  return { 1, window }
end

local total = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])

if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], window)
  ttl = redis.call("PTTL", KEYS[1])
end

return { total, ttl }
`;

export type AdminSearchRedisClient = Redis & {
  adminsearchRateLimit(
    key: string,
    windowMs: number,
  ): Promise<[number, number]>;
};

declare global {
  // `var` is required for a process-wide cache that survives Next.js reloads.
  // eslint-disable-next-line no-var
  var __adminsearchRedisClients: Map<string, Redis> | undefined;
}

function normalizeRedisUrl(redisUrl: string) {
  try {
    const url = new URL(redisUrl);

    if (
      (url.protocol === "redis:" || url.protocol === "rediss:") &&
      !url.searchParams.has("family")
    ) {
      url.searchParams.set("family", "0");
      return url.toString();
    }
  } catch {
    return redisUrl;
  }

  return redisUrl;
}

function configureRedisClient(client: Redis) {
  const configuredClient = client as AdminSearchRedisClient;

  if (typeof configuredClient.adminsearchRateLimit !== "function") {
    client.defineCommand("adminsearchRateLimit", {
      numberOfKeys: 1,
      lua: RATE_LIMIT_SCRIPT,
    });
  }

  return configuredClient;
}

export function getRedisClient(redisUrl = process.env.RATE_LIMIT_REDIS_URL) {
  if (!redisUrl) {
    return null;
  }

  const normalizedUrl = normalizeRedisUrl(redisUrl);
  const clients =
    globalThis.__adminsearchRedisClients ?? new Map<string, Redis>();
  globalThis.__adminsearchRedisClients = clients;

  const existingClient = clients.get(normalizedUrl);

  if (existingClient) {
    return configureRedisClient(existingClient);
  }

  const client = new Redis(normalizedUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
  });

  client.on("error", () => {
    // Callers provide a bounded in-memory fallback when Redis is unavailable.
  });
  clients.set(normalizedUrl, client);

  return configureRedisClient(client);
}
