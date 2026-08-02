type SearchTimingPhase =
  | "prepare"
  | "rate-limit"
  | "serialize"
  | "transform"
  | "upstream";

type Now = () => number;

const SERVER_TIMING_PHASES: ReadonlyArray<
  readonly [SearchTimingPhase, string]
> = [
  ["rate-limit", "rate-limit"],
  ["prepare", "prepare"],
  ["upstream", "upstream"],
  ["transform", "transform"],
  ["serialize", "serialize"],
];

export function createSearchTiming(now: Now = () => performance.now()) {
  const startedAt = readNow(now);
  const phaseDurations = new Map<SearchTimingPhase, number>();
  let serviceDurationMs: number | undefined;
  let upstreamRequestCount = 0;

  function addPhaseDuration(phase: SearchTimingPhase, durationMs: number) {
    phaseDurations.set(
      phase,
      (phaseDurations.get(phase) ?? 0) + normalizeDuration(durationMs),
    );
  }

  function startPhase(phase: SearchTimingPhase) {
    const phaseStartedAt = readNow(now);
    let stopped = false;

    return () => {
      if (stopped) {
        return;
      }

      stopped = true;
      addPhaseDuration(phase, readNow(now) - phaseStartedAt);
    };
  }

  async function measureAsync<T>(
    phase: SearchTimingPhase,
    operation: () => Promise<T>,
  ) {
    const stop = startPhase(phase);

    try {
      return await operation();
    } finally {
      stop();
    }
  }

  function measureSync<T>(phase: SearchTimingPhase, operation: () => T) {
    const stop = startPhase(phase);

    try {
      return operation();
    } finally {
      stop();
    }
  }

  function getElapsedDuration() {
    return normalizeDuration(readNow(now) - startedAt);
  }

  function finishService() {
    serviceDurationMs ??= getElapsedDuration();
  }

  function recordUpstreamRequest() {
    upstreamRequestCount = Math.min(
      upstreamRequestCount + 1,
      Number.MAX_SAFE_INTEGER,
    );
  }

  function toServerTiming() {
    const metrics: string[] = [];

    for (const [phase, metricName] of SERVER_TIMING_PHASES) {
      const durationMs = phaseDurations.get(phase);

      if (durationMs === undefined) {
        continue;
      }

      const description =
        phase === "upstream" ? `;desc="requests=${upstreamRequestCount}"` : "";
      metrics.push(
        `${metricName};dur=${formatDuration(durationMs)}${description}`,
      );
    }

    if (serviceDurationMs !== undefined) {
      metrics.splice(
        Math.max(metrics.length - (phaseDurations.has("serialize") ? 1 : 0), 0),
        0,
        `total;dur=${formatDuration(serviceDurationMs)}`,
      );
    }

    return metrics.join(", ");
  }

  return {
    finishService,
    getElapsedDuration,
    measureAsync,
    measureSync,
    recordUpstreamRequest,
    toServerTiming,
  };
}

export type SearchTiming = ReturnType<typeof createSearchTiming>;

export function createSearchJsonResponse({
  headers,
  payload,
  status,
  timing,
}: {
  headers: HeadersInit;
  payload: unknown;
  status: number;
  timing: SearchTiming;
}) {
  const response = timing.measureSync("serialize", () =>
    Response.json(payload, {
      headers,
      status,
    }),
  );
  const serverTiming = timing.toServerTiming();

  if (serverTiming) {
    response.headers.set("Server-Timing", serverTiming);
  }

  return response;
}

export function createSearchTimingHeaders(
  headers: HeadersInit | undefined,
  timing: SearchTiming,
) {
  const responseHeaders = new Headers(headers);
  const serverTiming = timing.toServerTiming();

  if (serverTiming) {
    responseHeaders.set("Server-Timing", serverTiming);
  }

  return responseHeaders;
}

function readNow(now: Now) {
  const value = now();

  return Number.isFinite(value) ? value : 0;
}

function normalizeDuration(durationMs: number) {
  return Number.isFinite(durationMs) ? Math.max(durationMs, 0) : 0;
}

function formatDuration(durationMs: number) {
  return (Math.round(normalizeDuration(durationMs) * 100) / 100)
    .toFixed(2)
    .replace(/\.00$/u, "")
    .replace(/(\.\d)0$/u, "$1");
}
