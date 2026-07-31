import type { PersistedPreferences } from "@/features/settings/lib/preferences";

export const SEARCH_CACHE_VERSION = 4;

export function createSearchRuntimeKey(preferences: PersistedPreferences) {
  return JSON.stringify({
    engines: {
      general: [...preferences.engines.general].sort(),
      images: [...preferences.engines.images].sort(),
      videos: [...preferences.engines.videos].sort(),
      news: [...preferences.engines.news].sort(),
    },
    imageProxy: preferences.settings.imageProxy,
    plugins: {
      calculator: preferences.settings.calculator,
      doiRewrite: preferences.settings.doiRewrite,
      hashSearch: preferences.settings.hashSearch,
      selfInfo: preferences.settings.selfInfo,
      timeZone: preferences.settings.timeZone,
      trackerCleaner: preferences.settings.trackerCleaner,
      unitConverter: preferences.settings.unitConverter,
    },
    resultsPerPage: preferences.settings.loadMoreCount,
    httpMethod: preferences.settings.httpMethod,
    searchCacheVersion: SEARCH_CACHE_VERSION,
  });
}

export function createSearchRequestKey(
  queryStringWithoutPage: string,
  requestedPage: number,
  runtimeKey: string,
) {
  const params = new URLSearchParams(queryStringWithoutPage);
  params.sort();

  return JSON.stringify({
    params: params.toString(),
    page: requestedPage,
    runtime: runtimeKey,
  });
}
