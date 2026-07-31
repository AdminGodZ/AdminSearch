import { SEARCH_MAX_PAGE } from "@/features/search/lib/limits";
import type { SearchTab } from "@/features/search/types";
import type { SearchPreferenceDefaults } from "@/features/settings/lib/preferences";

type QueryParamValue = string | number | null | undefined;

export function applySearchPreferenceDefaults(
  current: URLSearchParams | { toString(): string },
  defaults: SearchPreferenceDefaults,
) {
  const params = new URLSearchParams(current.toString());

  if (!params.get("tab") && defaults.defaultTab !== "all") {
    params.set("tab", defaults.defaultTab);
  }

  if (!params.get("language") && defaults.language) {
    params.set("language", defaults.language);
  }

  if (!params.get("timeRange") && defaults.timeRange) {
    params.set("timeRange", defaults.timeRange);
  }

  if (!params.has("safeSearch") && defaults.safeSearch !== 0) {
    params.set("safeSearch", String(defaults.safeSearch));
  }

  return params;
}

export function normalizeSearchTab(value: string | null): SearchTab {
  switch (value) {
    case "images":
      return "images";
    case "videos":
      return "videos";
    case "news":
      return "news";
    default:
      return "all";
  }
}

export function normalizeSearchSafeSearch(value: string | null): 0 | 1 | 2 {
  if (value === "1") {
    return 1;
  }

  if (value === "2") {
    return 2;
  }

  return 0;
}

export function normalizeSearchPage(value: string | null) {
  const page = Number(value ?? "1");
  return Number.isInteger(page) && page > 0
    ? Math.min(page, SEARCH_MAX_PAGE)
    : 1;
}

export function mergeSearchParams(
  current: URLSearchParams | { toString(): string },
  updates: Record<string, QueryParamValue>,
) {
  const next = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      next.delete(key);
      continue;
    }

    next.set(key, String(value));
  }

  return next;
}

export function buildHref(
  pathname: string,
  current: URLSearchParams | { toString(): string },
  updates: Record<string, QueryParamValue> = {},
) {
  const params = mergeSearchParams(current, updates);
  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}
