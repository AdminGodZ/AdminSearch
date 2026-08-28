import type { SearchProviderFailure } from "@/features/search/types";

const MAX_PROVIDER_FAILURES = 50;
const MAX_ENGINE_NAME_LENGTH = 100;
const MAX_FAILURE_REASON_LENGTH = 240;

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\s+/gu, " ").trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, maxLength);
}

function failureKey(failure: SearchProviderFailure) {
  return `${failure.engine.toLowerCase()}\u0000${failure.reason.toLowerCase()}`;
}

export function extractProviderFailures(
  unresponsiveEngines: unknown,
): SearchProviderFailure[] {
  if (!Array.isArray(unresponsiveEngines)) {
    return [];
  }

  const failures: SearchProviderFailure[] = [];
  const seen = new Set<string>();

  for (const entry of unresponsiveEngines) {
    if (!Array.isArray(entry)) {
      continue;
    }

    const engine = normalizeText(entry[0], MAX_ENGINE_NAME_LENGTH);
    const reason = normalizeText(entry[1], MAX_FAILURE_REASON_LENGTH);

    if (!engine || !reason) {
      continue;
    }

    const failure = { engine, reason };
    const key = failureKey(failure);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    failures.push(failure);

    if (failures.length >= MAX_PROVIDER_FAILURES) {
      break;
    }
  }

  return failures;
}

export function mergeProviderFailures(
  ...failureGroups: (readonly SearchProviderFailure[] | undefined)[]
) {
  const failures: SearchProviderFailure[] = [];
  const seen = new Set<string>();

  for (const group of failureGroups) {
    for (const failure of group ?? []) {
      const engine = normalizeText(failure.engine, MAX_ENGINE_NAME_LENGTH);
      const reason = normalizeText(failure.reason, MAX_FAILURE_REASON_LENGTH);

      if (!engine || !reason) {
        continue;
      }

      const normalizedFailure = { engine, reason };
      const key = failureKey(normalizedFailure);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      failures.push(normalizedFailure);

      if (failures.length >= MAX_PROVIDER_FAILURES) {
        return failures;
      }
    }
  }

  return failures;
}
