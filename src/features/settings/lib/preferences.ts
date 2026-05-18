import type { SearchTab } from "@/features/search/types";

export const SETTINGS_COOKIE_NAME = "adminsearch-settings";
export const UI_LANGUAGE_STORAGE_KEY = "adminsearch-language";
export const UI_LANGUAGE_EVENT = "adminsearch:language-change";
export const SETTINGS_PERSIST_MODE_STORAGE_KEY = "adminsearch-settings-persist";
export const SETTINGS_SYNC_EVENT = "adminsearch:settings-sync";
export const SETTINGS_SYNC_STORAGE_KEY = "adminsearch-settings-sync";
const SETTINGS_COOKIE_VERSION = 1;

export type SettingsState = {
  locale: string;
  defaultTab: string;
  safeSearch: string;
  timeRange: string;
  autocomplete: string;
  faviconResolver: string;
  httpMethod: string;
  loadMoreCount: string;
  resultReuseMode: string;
  urlFormatting: string;
  uiLanguage: string;
  theme: string;
  openInNewTab: boolean;
  infiniteScroll: boolean;
  showFavicons: boolean;
  showThumbnails: boolean;
  compactDensity: boolean;
  queryInTitle: boolean;
  imageProxy: boolean;
  trackerCleaner: boolean;
  doiRewrite: boolean;
  storeDefaultsLocally: boolean;
  calculator: boolean;
  unitConverter: boolean;
  hashSearch: boolean;
  selfInfo: boolean;
  timeZone: boolean;
};

export type ResultReuseMode = "fresh" | "cache";
export type HttpMethod = "get" | "post";
export type UrlFormattingMode = "pretty" | "full" | "host";

export type EngineGroupKey = "general" | "images" | "videos" | "news";
export type EngineState = Record<EngineGroupKey, Set<string>>;

type StoredPreferencesPayload = {
  version: number;
  settings?: Partial<SettingsState>;
  engines?: Partial<Record<EngineGroupKey, string[]>>;
};

type LegacySettingsState = SettingsState & {
  engineTokens?: unknown;
};

export const defaultSettingsState: SettingsState = {
  locale: "auto",
  defaultTab: "all",
  safeSearch: "0",
  timeRange: "any",
  autocomplete: "google",
  faviconResolver: "google",
  httpMethod: "get",
  loadMoreCount: "20",
  resultReuseMode: "fresh",
  urlFormatting: "pretty",
  uiLanguage: "en",
  theme: "light",
  openInNewTab: true,
  infiniteScroll: true,
  showFavicons: true,
  showThumbnails: true,
  compactDensity: false,
  queryInTitle: false,
  imageProxy: false,
  trackerCleaner: false,
  doiRewrite: false,
  storeDefaultsLocally: true,
  calculator: true,
  unitConverter: true,
  hashSearch: true,
  selfInfo: true,
  timeZone: true,
};

export const engineCatalog: Record<EngineGroupKey, string[]> = {
  general: [
    "bing",
    "brave",
    "duckduckgo",
    "google",
    "mojeek",
    "qwant",
    "startpage",
    "yahoo",
    "ddg definitions",
    "wikidata",
    "wikipedia",
    "wolframalpha",
    "yandex",
  ],
  images: [
    "bing images",
    "brave.images",
    "google images",
    "mojeek images",
    "qwant images",
    "startpage images",
    "duckduckgo images",
    "yandex images",
  ],
  videos: [
    "bing videos",
    "brave.videos",
    "google videos",
    "qwant videos",
    "duckduckgo videos",
    "dailymotion",
    "youtube",
  ],
  news: [
    "mojeek news",
    "startpage news",
    "wikinews",
    "bing news",
    "brave.news",
    "duckduckgo news",
    "google news",
    "qwant news",
    "reuters",
    "yahoo news",
  ],
};

export const defaultEngineState: EngineState = {
  general: new Set([
    "duckduckgo",
    "ddg definitions",
    "brave",
    "google",
    "startpage",
  ]),
  images: new Set([
    "duckduckgo images",
    "brave.images",
    "google images",
    "startpage images",
  ]),
  videos: new Set(["youtube", "google videos"]),
  news: new Set([
    "google news",
    "startpage news",
    "wikinews",
    "brave.news",
    "duckduckgo news",
    "reuters",
    "yahoo news",
  ]),
};

export type PersistedPreferences = {
  engines: EngineState;
  settings: SettingsState;
};

export type SearchPreferenceDefaults = {
  defaultTab: SearchTab;
  language?: string;
  safeSearch: 0 | 1 | 2;
  timeRange?: "day" | "month" | "year";
};

export type SearchRuntimePreferences = {
  autocomplete: string;
  disabledPlugins: string[];
  enabledEngines: string[];
  enabledPlugins: string[];
  engineTokens?: string[];
  faviconResolver: string;
  httpMethod: HttpMethod;
  imageProxy: boolean;
  resultsPerPage: number;
};

export type SearchInterfacePreferences = Pick<
  SettingsState,
  | "compactDensity"
  | "faviconResolver"
  | "infiniteScroll"
  | "openInNewTab"
  | "queryInTitle"
  | "showFavicons"
  | "showThumbnails"
> & {
  resultReuseMode: ResultReuseMode;
  urlFormatting: UrlFormattingMode;
};

const PLUGIN_SETTING_MAP = {
  calculator: "calculator",
  hash_plugin: "hashSearch",
  self_info: "selfInfo",
  unit_converter: "unitConverter",
  time_zone: "timeZone",
  tracker_url_remover: "trackerCleaner",
  oa_doi_rewrite: "doiRewrite",
} as const satisfies Record<string, keyof SettingsState>;

function cloneEngineState(source: EngineState): EngineState {
  return {
    general: new Set(source.general),
    images: new Set(source.images),
    videos: new Set(source.videos),
    news: new Set(source.news),
  };
}

function sanitizeStringSetting(
  value: unknown,
  fallback: string,
  allowed?: readonly string[],
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return fallback;
  }

  if (allowed && !allowed.includes(trimmed)) {
    return fallback;
  }

  return trimmed;
}

function sanitizeBooleanSetting(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeResultReuseMode(
  value: string | undefined,
): ResultReuseMode {
  return value === "cache" ? "cache" : "fresh";
}

export function normalizeHttpMethod(value: string | undefined): HttpMethod {
  return value === "post" ? "post" : "get";
}

export function normalizeUrlFormattingMode(
  value: string | undefined,
): UrlFormattingMode {
  return value === "full" || value === "host" ? value : "pretty";
}

export function createDefaultPreferences(): PersistedPreferences {
  return {
    settings: { ...defaultSettingsState },
    engines: cloneEngineState(defaultEngineState),
  };
}

export function parsePreferencesCookie(
  rawValue: string | undefined,
): PersistedPreferences {
  const defaults = createDefaultPreferences();

  if (!rawValue) {
    return defaults;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(decodeURIComponent(rawValue));
  } catch {
    return defaults;
  }

  if (!parsed || typeof parsed !== "object") {
    return defaults;
  }

  const payload = parsed as StoredPreferencesPayload;

  if (payload.version !== SETTINGS_COOKIE_VERSION) {
    return defaults;
  }

  const settings = payload.settings ?? {};
  const engines = payload.engines ?? {};

  return {
    settings: {
      locale: sanitizeStringSetting(settings.locale, defaults.settings.locale, [
        "auto",
        "en",
        "de",
        "fr",
        "es",
        "it",
        "en-US",
        "de-CH",
      ]),
      defaultTab: sanitizeStringSetting(
        settings.defaultTab,
        defaults.settings.defaultTab,
        ["all", "images", "videos", "news"],
      ),
      safeSearch: sanitizeStringSetting(
        settings.safeSearch,
        defaults.settings.safeSearch,
        ["0", "1", "2"],
      ),
      timeRange: sanitizeStringSetting(
        settings.timeRange,
        defaults.settings.timeRange,
        ["any", "day", "month", "year"],
      ),
      autocomplete: sanitizeStringSetting(
        settings.autocomplete,
        defaults.settings.autocomplete,
        [
          "google",
          "brave",
          "duckduckgo",
          "bing",
          "startpage",
          "qwant",
          "wikipedia",
        ],
      ),
      faviconResolver: sanitizeStringSetting(
        settings.faviconResolver,
        defaults.settings.faviconResolver,
        ["google", "duckduckgo"],
      ),
      httpMethod: sanitizeStringSetting(
        settings.httpMethod,
        defaults.settings.httpMethod,
        ["get", "post"],
      ),
      loadMoreCount: sanitizeStringSetting(
        settings.loadMoreCount,
        defaults.settings.loadMoreCount,
        ["10", "20", "30", "40"],
      ),
      resultReuseMode: sanitizeStringSetting(
        settings.resultReuseMode,
        defaults.settings.resultReuseMode,
        ["fresh", "cache"],
      ),
      uiLanguage: sanitizeStringSetting(
        settings.uiLanguage,
        defaults.settings.uiLanguage,
        ["en", "de"],
      ),
      theme: sanitizeStringSetting(settings.theme, defaults.settings.theme, [
        "light",
        "dark",
      ]),
      urlFormatting: sanitizeStringSetting(
        settings.urlFormatting,
        defaults.settings.urlFormatting,
        ["pretty", "full", "host"],
      ),
      openInNewTab: sanitizeBooleanSetting(
        settings.openInNewTab,
        defaults.settings.openInNewTab,
      ),
      infiniteScroll: sanitizeBooleanSetting(
        settings.infiniteScroll,
        defaults.settings.infiniteScroll,
      ),
      showFavicons: sanitizeBooleanSetting(
        settings.showFavicons,
        defaults.settings.showFavicons,
      ),
      showThumbnails: sanitizeBooleanSetting(
        settings.showThumbnails,
        defaults.settings.showThumbnails,
      ),
      compactDensity: sanitizeBooleanSetting(
        settings.compactDensity,
        defaults.settings.compactDensity,
      ),
      queryInTitle: sanitizeBooleanSetting(
        settings.queryInTitle,
        defaults.settings.queryInTitle,
      ),
      imageProxy: sanitizeBooleanSetting(
        settings.imageProxy,
        defaults.settings.imageProxy,
      ),
      trackerCleaner: sanitizeBooleanSetting(
        settings.trackerCleaner,
        defaults.settings.trackerCleaner,
      ),
      doiRewrite: sanitizeBooleanSetting(
        settings.doiRewrite,
        defaults.settings.doiRewrite,
      ),
      storeDefaultsLocally: sanitizeBooleanSetting(
        settings.storeDefaultsLocally,
        defaults.settings.storeDefaultsLocally,
      ),
      calculator: sanitizeBooleanSetting(
        settings.calculator,
        defaults.settings.calculator,
      ),
      unitConverter: sanitizeBooleanSetting(
        settings.unitConverter,
        defaults.settings.unitConverter,
      ),
      hashSearch: sanitizeBooleanSetting(
        settings.hashSearch,
        defaults.settings.hashSearch,
      ),
      selfInfo: sanitizeBooleanSetting(
        settings.selfInfo,
        defaults.settings.selfInfo,
      ),
      timeZone: sanitizeBooleanSetting(
        settings.timeZone,
        defaults.settings.timeZone,
      ),
    },
    engines: {
      general: new Set(
        Array.isArray(engines.general)
          ? engines.general.filter((engine) =>
              engineCatalog.general.includes(engine),
            )
          : defaults.engines.general,
      ),
      images: new Set(
        Array.isArray(engines.images)
          ? engines.images.filter((engine) =>
              engineCatalog.images.includes(engine),
            )
          : defaults.engines.images,
      ),
      videos: new Set(
        Array.isArray(engines.videos)
          ? engines.videos.filter((engine) =>
              engineCatalog.videos.includes(engine),
            )
          : defaults.engines.videos,
      ),
      news: new Set(
        Array.isArray(engines.news)
          ? engines.news.filter((engine) => engineCatalog.news.includes(engine))
          : defaults.engines.news,
      ),
    },
  };
}

export function serializePreferencesCookie(
  value: PersistedPreferences,
): string {
  const { engineTokens: _engineTokens, ...settings } =
    value.settings as LegacySettingsState;
  const payload: StoredPreferencesPayload = {
    version: SETTINGS_COOKIE_VERSION,
    settings,
    engines: {
      general: [...value.engines.general],
      images: [...value.engines.images],
      videos: [...value.engines.videos],
      news: [...value.engines.news],
    },
  };

  return encodeURIComponent(JSON.stringify(payload));
}

export function getSearchPreferenceDefaults(
  settings: SettingsState,
): SearchPreferenceDefaults {
  const baseLanguage =
    settings.locale === "auto"
      ? undefined
      : settings.locale.includes("-")
        ? settings.locale.split("-")[0]
        : settings.locale;

  return {
    defaultTab:
      settings.defaultTab === "images" ||
      settings.defaultTab === "videos" ||
      settings.defaultTab === "news"
        ? settings.defaultTab
        : "all",
    language: baseLanguage,
    safeSearch:
      settings.safeSearch === "1" ? 1 : settings.safeSearch === "2" ? 2 : 0,
    timeRange:
      settings.timeRange === "day" ||
      settings.timeRange === "month" ||
      settings.timeRange === "year"
        ? settings.timeRange
        : undefined,
  };
}

function getEngineGroupForTab(tab: SearchTab): EngineGroupKey {
  switch (tab) {
    case "images":
      return "images";
    case "videos":
      return "videos";
    case "news":
      return "news";
    default:
      return "general";
  }
}

export function getResultsPerPage(settings: SettingsState) {
  const parsed = Number.parseInt(settings.loadMoreCount, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return Number.parseInt(defaultSettingsState.loadMoreCount, 10);
  }

  return parsed;
}

export function getEnabledEnginesForTab(engines: EngineState, tab: SearchTab) {
  return [...engines[getEngineGroupForTab(tab)]];
}

export function getPluginPreferenceState(settings: SettingsState) {
  const enabledPlugins: string[] = [];
  const disabledPlugins: string[] = [];

  for (const [pluginId, settingKey] of Object.entries(PLUGIN_SETTING_MAP)) {
    if (settings[settingKey]) {
      enabledPlugins.push(pluginId);
    } else {
      disabledPlugins.push(pluginId);
    }
  }

  return {
    enabledPlugins,
    disabledPlugins,
  };
}

export function getSearchRuntimePreferences(
  settings: SettingsState,
  engines: EngineState,
  tab: SearchTab,
): SearchRuntimePreferences {
  const pluginState = getPluginPreferenceState(settings);

  return {
    autocomplete: settings.autocomplete,
    disabledPlugins: pluginState.disabledPlugins,
    enabledEngines: getEnabledEnginesForTab(engines, tab),
    enabledPlugins: pluginState.enabledPlugins,
    faviconResolver: settings.faviconResolver,
    httpMethod: normalizeHttpMethod(settings.httpMethod),
    imageProxy: settings.imageProxy,
    resultsPerPage: getResultsPerPage(settings),
  };
}

export function getSearchInterfacePreferences(
  settings: SettingsState,
): SearchInterfacePreferences {
  return {
    compactDensity: settings.compactDensity,
    faviconResolver: settings.faviconResolver,
    infiniteScroll: settings.infiniteScroll,
    openInNewTab: settings.openInNewTab,
    queryInTitle: settings.queryInTitle,
    resultReuseMode: normalizeResultReuseMode(settings.resultReuseMode),
    showFavicons: settings.showFavicons,
    showThumbnails: settings.showThumbnails,
    urlFormatting: normalizeUrlFormattingMode(settings.urlFormatting),
  };
}
