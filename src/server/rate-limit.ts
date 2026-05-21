import Redis from "ioredis";

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs?: number;
  maxRequests?: number;
};

type MemoryEntry = {
  count: number;
  resetAt: number;
};

const MEMORY_STORE_MAX_ENTRIES = 10_000;
const MEMORY_STORE_PRUNE_INTERVAL_MS = 60_000;
const memoryStore = new Map<string, MemoryEntry>();
let lastMemoryStorePruneAt = 0;

declare global {
  // eslint-disable-next-line no-var
  var __adminsearchRedis: Redis | null | undefined;
}

function getWindowMs(options?: RateLimitOptions) {
  return (
    options?.windowMs ??
    Number(process.env.SEARCH_RATE_LIMIT_WINDOW_MS ?? 60_000)
  );
}

function getMaxRequests(options?: RateLimitOptions) {
  return (
    options?.maxRequests ?? Number(process.env.SEARCH_RATE_LIMIT_MAX ?? 30)
  );
}

function pruneMemoryStore(now: number, force = false) {
  if (
    !force &&
    memoryStore.size <= MEMORY_STORE_MAX_ENTRIES &&
    now - lastMemoryStorePruneAt < MEMORY_STORE_PRUNE_INTERVAL_MS
  ) {
    return;
  }

  lastMemoryStorePruneAt = now;

  for (const [key, entry] of memoryStore) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }

  while (memoryStore.size > MEMORY_STORE_MAX_ENTRIES) {
    const oldestKey = memoryStore.keys().next();

    if (oldestKey.done) {
      break;
    }

    memoryStore.delete(oldestKey.value);
  }
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

async function checkMemoryRateLimit(
  key: string,
  options?: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = getWindowMs(options);
  const limit = getMaxRequests(options);

  pruneMemoryStore(now);

  const current = memoryStore.get(key);

  if (!current || current.resetAt <= now) {
    memoryStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    pruneMemoryStore(now, true);

    return {
      allowed: true,
      limit,
      remaining: Math.max(limit - 1, 0),
      resetAt: now + windowMs,
    };
  }

  current.count += 1;
  memoryStore.delete(key);
  memoryStore.set(key, current);

  return {
    allowed: current.count <= limit,
    limit,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt,
  };
}

export async function checkRateLimit(
  key: string,
  options?: RateLimitOptions,
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const windowMs = getWindowMs(options);
  const limit = getMaxRequests(options);

  if (!redis) {
    return checkMemoryRateLimit(key, options);
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
    return checkMemoryRateLimit(key, options);
  }
}

export function createRateLimitHeaders(result: RateLimitResult) {
  return {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(result.resetAt),
  };
}
