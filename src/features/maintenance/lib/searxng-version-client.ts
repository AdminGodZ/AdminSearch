export type SearxngStatusState = "latest" | "outdated" | "unknown";

export const SEARXNG_VERSION_RETRY_DELAYS_MS = [
  15_000,
  60_000,
  5 * 60_000,
] as const;

export type SearxngVersionStatus = {
  currentVersion: string | null;
  latestVersion: string | null;
  state: SearxngStatusState;
};

export const INITIAL_SEARXNG_VERSION_STATUS: SearxngVersionStatus = {
  currentVersion: null,
  latestVersion: null,
  state: "unknown",
};

type RetryScheduler = {
  clearTimeout: (timeout: unknown) => void;
  setTimeout: (
    callback: () => Promise<void> | void,
    delayMs: number,
  ) => unknown;
};

type SearxngVersionClientOptions = {
  fetcher?: typeof fetch;
  onStatus: (status: SearxngVersionStatus) => void;
  retryDelaysMs?: readonly number[];
  scheduler?: RetryScheduler;
};

const defaultScheduler: RetryScheduler = {
  clearTimeout: (timeout) => window.clearTimeout(timeout as number),
  setTimeout: (callback, delayMs) =>
    window.setTimeout(() => {
      void callback();
    }, delayMs),
};

export function createSearxngVersionClient({
  fetcher = fetch,
  onStatus,
  retryDelaysMs = SEARXNG_VERSION_RETRY_DELAYS_MS,
  scheduler = defaultScheduler,
}: SearxngVersionClientOptions) {
  const controller = new AbortController();
  let retryIndex = 0;
  let retryTimeout: unknown;
  let started = false;
  let stopped = false;

  async function readStatus() {
    if (stopped) {
      return;
    }

    let nextStatus = INITIAL_SEARXNG_VERSION_STATUS;

    try {
      const response = await fetcher("/api/searxng/version", {
        cache: "default",
        signal: controller.signal,
      });

      if (response.ok) {
        nextStatus = parseSearxngVersionStatus(await response.json());
      }
    } catch {
      if (stopped || controller.signal.aborted) {
        return;
      }
    }

    if (stopped) {
      return;
    }

    onStatus(nextStatus);

    if (nextStatus.state !== "unknown") {
      return;
    }

    const retryDelayMs = retryDelaysMs[retryIndex];

    if (retryDelayMs === undefined) {
      return;
    }

    retryIndex += 1;
    retryTimeout = scheduler.setTimeout(async () => {
      retryTimeout = undefined;
      await readStatus();
    }, retryDelayMs);
  }

  return {
    async start() {
      if (started || stopped) {
        return;
      }

      started = true;
      await readStatus();
    },
    stop() {
      if (stopped) {
        return;
      }

      stopped = true;
      controller.abort();

      if (retryTimeout !== undefined) {
        scheduler.clearTimeout(retryTimeout);
        retryTimeout = undefined;
      }
    },
  };
}

function parseSearxngVersionStatus(value: unknown): SearxngVersionStatus {
  if (!value || typeof value !== "object") {
    return INITIAL_SEARXNG_VERSION_STATUS;
  }

  const status = value as Partial<SearxngVersionStatus>;
  const state =
    status.state === "latest" || status.state === "outdated"
      ? status.state
      : "unknown";

  return {
    currentVersion: sanitizeVersion(status.currentVersion),
    latestVersion: sanitizeVersion(status.latestVersion),
    state,
  };
}

function sanitizeVersion(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed || null;
}
