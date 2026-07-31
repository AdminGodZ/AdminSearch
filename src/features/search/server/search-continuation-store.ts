import { createHash, randomBytes } from "node:crypto";

import { SEARCH_MAX_PAGE } from "@/features/search/lib/limits";
import {
  isSearxPaginationState,
  type SearxPaginationState,
} from "@/features/search/server/search-pagination";
import { getRedisClient } from "@/server/redis";

const CURSOR_PREFIX = "search_v1_";
const CURSOR_ID_PATTERN = /^[\w-]{24}$/u;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_RETRY_TTL_MS = 60 * 1000;
const DEFAULT_MEMORY_MAX_ENTRIES = 1_000;
const MAX_SERIALIZED_STATE_BYTES = 256 * 1024;
const REDIS_KEY_PREFIX = "adminsearch:search-continuation:v1:";

type MemoryContinuationEntry = {
  expiresAt: number;
  serializedState: string;
};

export type SearchContinuationState = {
  version: 1;
  fingerprint: string;
  nextClientPage: number;
  pagination: SearxPaginationState;
  videoEngineData?: Record<string, Record<string, string>>;
};

const memoryContinuations = new Map<string, MemoryContinuationEntry>();

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function getContinuationTtlMs() {
  return readBoundedInteger(
    process.env.SEARCH_CONTINUATION_TTL_MS,
    DEFAULT_TTL_MS,
    60_000,
    60 * 60 * 1000,
  );
}

function getRetryTtlMs() {
  return readBoundedInteger(
    process.env.SEARCH_CONTINUATION_RETRY_TTL_MS,
    DEFAULT_RETRY_TTL_MS,
    10_000,
    5 * 60 * 1000,
  );
}

function getMemoryMaxEntries() {
  return readBoundedInteger(
    process.env.SEARCH_CONTINUATION_MEMORY_MAX_ENTRIES,
    DEFAULT_MEMORY_MAX_ENTRIES,
    10,
    10_000,
  );
}

function getContinuationRedisUrl() {
  return (
    process.env.SEARCH_CONTINUATION_REDIS_URL?.trim() ||
    process.env.RATE_LIMIT_REDIS_URL
  );
}

function isSearchContinuationState(
  value: unknown,
): value is SearchContinuationState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const state = value as Partial<SearchContinuationState>;

  return (
    state.version === 1 &&
    typeof state.fingerprint === "string" &&
    /^[\w-]{43}$/u.test(state.fingerprint) &&
    Number.isInteger(state.nextClientPage) &&
    Number(state.nextClientPage) >= 2 &&
    Number(state.nextClientPage) <= SEARCH_MAX_PAGE &&
    isSearxPaginationState(state.pagination) &&
    state.pagination.nextUpstreamPage <= SEARCH_MAX_PAGE + 1 &&
    (state.videoEngineData === undefined ||
      isStoredVideoEngineData(state.videoEngineData))
  );
}

function isStoredVideoEngineData(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const engines = Object.entries(value);

  return (
    engines.length <= 50 &&
    engines.every(([engine, rawValues]) => {
      if (
        engine.length > 128 ||
        !rawValues ||
        typeof rawValues !== "object" ||
        Array.isArray(rawValues)
      ) {
        return false;
      }

      const values = Object.entries(rawValues);

      return (
        values.length <= 50 &&
        values.every(
          ([key, rawValue]) =>
            key.length <= 128 &&
            typeof rawValue === "string" &&
            rawValue.length <= 4_096,
        )
      );
    })
  );
}

function serializeState(state: SearchContinuationState) {
  if (!isSearchContinuationState(state)) {
    return undefined;
  }

  try {
    const serializedState = JSON.stringify(state);

    return Buffer.byteLength(serializedState, "utf8") <=
      MAX_SERIALIZED_STATE_BYTES
      ? serializedState
      : undefined;
  } catch {
    return undefined;
  }
}

function parseState(serializedState: string) {
  if (Buffer.byteLength(serializedState, "utf8") > MAX_SERIALIZED_STATE_BYTES) {
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(serializedState);
    return isSearchContinuationState(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function parseCursor(cursor: string) {
  if (!cursor.startsWith(CURSOR_PREFIX)) {
    return undefined;
  }

  const id = cursor.slice(CURSOR_PREFIX.length);
  return CURSOR_ID_PATTERN.test(id) ? id : undefined;
}

function toRedisKey(id: string) {
  return `${REDIS_KEY_PREFIX}${id}`;
}

function pruneMemoryContinuations(now = Date.now()) {
  for (const [key, entry] of memoryContinuations) {
    if (entry.expiresAt <= now) {
      memoryContinuations.delete(key);
    }
  }

  const maximumEntries = getMemoryMaxEntries();

  while (memoryContinuations.size > maximumEntries) {
    const oldest = memoryContinuations.keys().next();

    if (oldest.done) {
      break;
    }

    memoryContinuations.delete(oldest.value);
  }
}

function readMemoryContinuation(key: string) {
  const entry = memoryContinuations.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    memoryContinuations.delete(key);
    return undefined;
  }

  memoryContinuations.delete(key);
  memoryContinuations.set(key, entry);

  return parseState(entry.serializedState);
}

export function createSearchContinuationFingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value) ?? "null")
    .digest("base64url");
}

export async function saveSearchContinuation(state: SearchContinuationState) {
  const serializedState = serializeState(state);

  if (!serializedState) {
    return undefined;
  }

  const id = randomBytes(18).toString("base64url");
  const key = toRedisKey(id);
  const cursor = `${CURSOR_PREFIX}${id}`;
  const ttlMs = getContinuationTtlMs();
  const redis = getRedisClient(getContinuationRedisUrl());

  if (redis) {
    try {
      await redis.set(key, serializedState, "PX", ttlMs);
      return cursor;
    } catch {
      // The bounded process-local store keeps single-instance search usable.
    }
  }

  memoryContinuations.set(key, {
    expiresAt: Date.now() + ttlMs,
    serializedState,
  });
  pruneMemoryContinuations();

  return cursor;
}

export async function loadSearchContinuation(cursor: string) {
  const id = parseCursor(cursor);

  if (!id) {
    return undefined;
  }

  const key = toRedisKey(id);
  const memoryState = readMemoryContinuation(key);

  if (memoryState) {
    return memoryState;
  }

  const redis = getRedisClient(getContinuationRedisUrl());

  if (!redis) {
    return undefined;
  }

  try {
    const serializedState = await redis.get(key);
    return serializedState ? parseState(serializedState) : undefined;
  } catch {
    return undefined;
  }
}

export async function shortenSearchContinuation(cursor: string) {
  const id = parseCursor(cursor);

  if (!id) {
    return;
  }

  const key = toRedisKey(id);
  const retryTtlMs = getRetryTtlMs();
  const memoryEntry = memoryContinuations.get(key);

  if (memoryEntry) {
    memoryEntry.expiresAt = Math.min(
      memoryEntry.expiresAt,
      Date.now() + retryTtlMs,
    );
    return;
  }

  const redis = getRedisClient(getContinuationRedisUrl());

  if (!redis) {
    return;
  }

  try {
    await redis.pexpire(key, retryTtlMs);
  } catch {
    // Expiration is best-effort; the original bounded TTL still applies.
  }
}
