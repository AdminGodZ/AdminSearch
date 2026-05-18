import Redis from "ioredis";

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type MemoryEntry = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, MemoryEntry>();

declare global {
  // eslint-disable-next-line no-var
  var __adminsearchRedis: Redis | null | undefined;
}

function getWindowMs() {
  return Number(process.env.SEARCH_RATE_LIMIT_WINDOW_MS ?? 60_000);
}

function getMaxRequests() {
  return Number(process.env.SEARCH_RATE_LIMIT_MAX ?? 30);
}

function getRedisClient() {
  if (global.__adminsearchRedis !== undefined) {
    return global.__adminsearchRedis;
  }

  const redisUrl = process.env.RATE_LIMIT_REDIS_URL;

  if (!redisUrl) {
    global.__adminsearchRedis = null;
    return global.__adminsearchRedis;
  }

  global.__adminsearchRedis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
  });

  global.__adminsearchRedis.on("error", () => {
    // Fall back to the in-memory limiter when Redis is unavailable.
  });

  return global.__adminsearchRedis;
}

async function checkMemoryRateLimit(key: string): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = getWindowMs();
  const limit = getMaxRequests();
  const current = memoryStore.get(key);

  if (!current || current.resetAt <= now) {
    memoryStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      limit,
      remaining: Math.max(limit - 1, 0),
      resetAt: now + windowMs,
    };
  }

  current.count += 1;
  memoryStore.set(key, current);

  return {
    allowed: current.count <= limit,
    limit,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt,
  };
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const windowMs = getWindowMs();
  const limit = getMaxRequests();

  if (!redis) {
    return checkMemoryRateLimit(key);
  }

  const namespacedKey = `adminsearch:ratelimit:${key}`;

  try {
    const total = await redis.incr(namespacedKey);

    if (total === 1) {
      await redis.pexpire(namespacedKey, windowMs);
    }

    const ttl = await redis.pttl(namespacedKey);
    const resetAt = Date.now() + Math.max(ttl, 0);

    return {
      allowed: total <= limit,
      limit,
      remaining: Math.max(limit - total, 0),
      resetAt,
    };
  } catch {
    return checkMemoryRateLimit(key);
  }
}

export function createRateLimitHeaders(result: RateLimitResult) {
  return {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(result.resetAt),
  };
}
