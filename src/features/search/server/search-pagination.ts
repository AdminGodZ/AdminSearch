import { createHash } from "node:crypto";

import type { SearxRawResult, SearxResponse } from "@/features/search/types";

const MAX_BUFFERED_RESULTS = 200;
const MAX_SEEN_RESULTS = 4_096;
const MAX_RESULTS_PER_PAGE = 100;

export type SearxPaginationState = {
  version: 1;
  nextUpstreamPage: number;
  seenResultHashes: string[];
  seenResultCount: number;
  bufferedResults: SearxRawResult[];
  totalAvailable?: number;
  exhausted: boolean;
};

type ConsumeSearxResultPageOptions = {
  fetchPage: (upstreamPage: number) => Promise<SearxResponse>;
  maxPageFetches?: number;
  maxUpstreamPages: number;
  resultsPerPage: number;
  state: SearxPaginationState;
};

export type ConsumedSearxResultPage = {
  firstPayload?: SearxResponse;
  hasMore: boolean;
  numberOfResults: number;
  results: SearxRawResult[];
  state: SearxPaginationState;
  unresponsiveEngines: unknown[];
};

export function createSearxPaginationState(): SearxPaginationState {
  return {
    version: 1,
    nextUpstreamPage: 1,
    seenResultHashes: [],
    seenResultCount: 0,
    bufferedResults: [],
    exhausted: false,
  };
}

export function isSearxPaginationState(
  value: unknown,
): value is SearxPaginationState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const state = value as Partial<SearxPaginationState>;

  return (
    state.version === 1 &&
    Number.isInteger(state.nextUpstreamPage) &&
    Number(state.nextUpstreamPage) >= 1 &&
    Number(state.nextUpstreamPage) <= 100 &&
    Array.isArray(state.seenResultHashes) &&
    state.seenResultHashes.length <= MAX_SEEN_RESULTS &&
    state.seenResultHashes.every(
      (hash) => typeof hash === "string" && /^[\w-]{43}$/u.test(hash),
    ) &&
    Number.isInteger(state.seenResultCount) &&
    Number(state.seenResultCount) >= state.seenResultHashes.length &&
    Number(state.seenResultCount) <= MAX_SEEN_RESULTS &&
    Array.isArray(state.bufferedResults) &&
    state.bufferedResults.length <= MAX_BUFFERED_RESULTS &&
    state.bufferedResults.every(
      (result) =>
        Boolean(result) && typeof result === "object" && !Array.isArray(result),
    ) &&
    (state.totalAvailable === undefined ||
      (Number.isFinite(state.totalAvailable) &&
        Number(state.totalAvailable) > 0)) &&
    typeof state.exhausted === "boolean"
  );
}

function readRawResultUrl(result: SearxRawResult) {
  const keys = ["url", "img_src", "thumbnail_src"] as const;

  for (const key of keys) {
    const value = result[key];

    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function hashResultUrl(url: string) {
  return createHash("sha256").update(url).digest("base64url");
}

function cloneState(state: SearxPaginationState): SearxPaginationState {
  return {
    ...state,
    seenResultHashes: [...state.seenResultHashes],
    bufferedResults: [...state.bufferedResults],
  };
}

function validateOptions({
  maxPageFetches,
  maxUpstreamPages,
  resultsPerPage,
  state,
}: Omit<ConsumeSearxResultPageOptions, "fetchPage">) {
  if (!isSearxPaginationState(state)) {
    throw new TypeError("Invalid SearX pagination state");
  }

  if (
    !Number.isInteger(resultsPerPage) ||
    resultsPerPage < 1 ||
    resultsPerPage > MAX_RESULTS_PER_PAGE
  ) {
    throw new RangeError("Invalid SearX result page size");
  }

  if (!Number.isInteger(maxUpstreamPages) || maxUpstreamPages < 1) {
    throw new RangeError("Invalid SearX upstream page limit");
  }

  if (
    maxPageFetches !== undefined &&
    (!Number.isInteger(maxPageFetches) ||
      maxPageFetches < 1 ||
      maxPageFetches > maxUpstreamPages)
  ) {
    throw new RangeError("Invalid SearX per-request page limit");
  }
}

export async function consumeSearxResultPage({
  fetchPage,
  maxPageFetches,
  maxUpstreamPages,
  resultsPerPage,
  state: inputState,
}: ConsumeSearxResultPageOptions): Promise<ConsumedSearxResultPage> {
  validateOptions({
    maxPageFetches,
    maxUpstreamPages,
    resultsPerPage,
    state: inputState,
  });

  const state = cloneState(inputState);
  const seenResultHashes = new Set(state.seenResultHashes);
  let firstPayload: SearxResponse | undefined;
  let fetchedPageCount = 0;
  const unresponsiveEngines: unknown[] = [];

  while (
    state.bufferedResults.length < resultsPerPage &&
    !state.exhausted &&
    (maxPageFetches === undefined || fetchedPageCount < maxPageFetches)
  ) {
    if (state.nextUpstreamPage > maxUpstreamPages) {
      state.exhausted = true;
      break;
    }

    const payload = await fetchPage(state.nextUpstreamPage);
    fetchedPageCount += 1;
    firstPayload ??= payload;
    state.nextUpstreamPage += 1;

    if (Array.isArray(payload.unresponsive_engines)) {
      unresponsiveEngines.push(...payload.unresponsive_engines);
    }

    if (
      typeof payload.number_of_results === "number" &&
      Number.isFinite(payload.number_of_results) &&
      payload.number_of_results > 0
    ) {
      state.totalAvailable = payload.number_of_results;
    }

    const pageResults = Array.isArray(payload.results) ? payload.results : [];

    if (pageResults.length === 0) {
      state.exhausted = true;
      break;
    }

    for (const result of pageResults) {
      const url = readRawResultUrl(result);

      if (url) {
        const resultHash = hashResultUrl(url);

        if (seenResultHashes.has(resultHash)) {
          continue;
        }

        seenResultHashes.add(resultHash);
        state.seenResultHashes.push(resultHash);
      }

      state.bufferedResults.push(result);
      state.seenResultCount += 1;

      if (
        state.bufferedResults.length >= MAX_BUFFERED_RESULTS ||
        state.seenResultCount >= MAX_SEEN_RESULTS
      ) {
        state.exhausted = true;
        break;
      }
    }

    if (
      state.totalAvailable !== undefined &&
      state.seenResultCount >= state.totalAvailable
    ) {
      state.exhausted = true;
    }

    if (state.nextUpstreamPage > maxUpstreamPages) {
      state.exhausted = true;
    }
  }

  const results = state.bufferedResults.slice(0, resultsPerPage);
  state.bufferedResults = state.bufferedResults.slice(resultsPerPage);

  return {
    firstPayload,
    hasMore: state.bufferedResults.length > 0 || !state.exhausted,
    numberOfResults: state.totalAvailable ?? state.seenResultCount,
    results,
    state,
    unresponsiveEngines,
  };
}
