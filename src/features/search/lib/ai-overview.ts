import type { SearchResult } from "@/features/search/types";

export const AI_OVERVIEW_MAX_RESULTS = 24;
export const AI_OVERVIEW_MAX_REQUEST_BYTES = 64 * 1024;
export const AI_OVERVIEW_MAX_RESPONSE_BYTES = 64 * 1024;
export const AI_OVERVIEW_MAX_TEXT_LENGTH = 8_000;
const AI_OVERVIEW_MAX_TITLE_LENGTH = 300;
const AI_OVERVIEW_MAX_CONTENT_LENGTH = 2_000;
const AI_OVERVIEW_MAX_URL_LENGTH = 2_048;
const AI_OVERVIEW_MAX_QUERY_LENGTH = 512;
const SAFE_WEB_PROTOCOLS = new Set(["http:", "https:"]);

export type AiOverviewSource = {
  title: string;
  content: string;
  url: string;
};

export type AiOverviewRequest = {
  query: string;
  results: AiOverviewSource[];
};

function readBoundedText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" || trimmed.length > maxLength ? undefined : trimmed;
}

function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return SAFE_WEB_PROTOCOLS.has(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeAiOverviewSource(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const title = readBoundedText(source.title, AI_OVERVIEW_MAX_TITLE_LENGTH);
  const content = readBoundedText(
    source.content,
    AI_OVERVIEW_MAX_CONTENT_LENGTH,
  );
  const rawUrl = readBoundedText(source.url, AI_OVERVIEW_MAX_URL_LENGTH);
  const url = rawUrl ? normalizeSourceUrl(rawUrl) : undefined;

  if (!title || !content || !url) {
    return undefined;
  }

  return { title, content, url } satisfies AiOverviewSource;
}

export function normalizeAiOverviewRequest(
  value: unknown,
): AiOverviewRequest | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const payload = value as Record<string, unknown>;
  const query = readBoundedText(payload.query, AI_OVERVIEW_MAX_QUERY_LENGTH);

  if (
    !query ||
    !Array.isArray(payload.results) ||
    payload.results.length === 0 ||
    payload.results.length > AI_OVERVIEW_MAX_RESULTS
  ) {
    return undefined;
  }

  const results = payload.results.map(normalizeAiOverviewSource);

  if (results.some((result) => !result)) {
    return undefined;
  }

  return {
    query,
    results: results as AiOverviewSource[],
  };
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function buildAiOverviewSources(results: SearchResult[]) {
  const sources: AiOverviewSource[] = [];

  for (const result of results) {
    if (result.kind !== "web") {
      continue;
    }

    const title = truncate(result.title.trim(), AI_OVERVIEW_MAX_TITLE_LENGTH);
    const url = normalizeSourceUrl(result.url);
    const content = truncate(
      (result.snippet?.trim() || title).trim(),
      AI_OVERVIEW_MAX_CONTENT_LENGTH,
    );

    if (!title || !content || !url || url.length > AI_OVERVIEW_MAX_URL_LENGTH) {
      continue;
    }

    sources.push({ title, content, url });

    if (sources.length === AI_OVERVIEW_MAX_RESULTS) {
      break;
    }
  }

  return sources;
}

export function createAiOverviewRequestBody(
  query: string,
  results: SearchResult[],
) {
  const normalizedQuery = readBoundedText(query, AI_OVERVIEW_MAX_QUERY_LENGTH);
  const sources = buildAiOverviewSources(results);

  if (!normalizedQuery || sources.length === 0) {
    return "";
  }

  while (sources.length > 0) {
    const body = JSON.stringify({ query: normalizedQuery, results: sources });

    if (
      new TextEncoder().encode(body).byteLength <= AI_OVERVIEW_MAX_REQUEST_BYTES
    ) {
      return body;
    }

    sources.pop();
  }

  return "";
}

export function readAiOverviewText(value: unknown) {
  if (!value || typeof value !== "object" || !("text" in value)) {
    return undefined;
  }

  const text = (value as { text?: unknown }).text;

  if (typeof text !== "string") {
    return undefined;
  }

  const trimmed = text.trim();

  if (trimmed === "") {
    return undefined;
  }

  return truncate(trimmed, AI_OVERVIEW_MAX_TEXT_LENGTH);
}
