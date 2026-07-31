import Redis from "ioredis";

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
    return existingClient;
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

  return client;
}
