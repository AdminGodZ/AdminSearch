import {
  type PersistedPreferences,
  parsePreferencesCookie,
  preferencesCookieNeedsMigration,
  SETTINGS_COOKIE_NAME,
  SETTINGS_PERSIST_MODE_STORAGE_KEY,
  SETTINGS_SYNC_EVENT,
  SETTINGS_SYNC_STORAGE_KEY,
  serializePreferencesCookie,
  UI_LANGUAGE_STORAGE_KEY,
} from "@/features/settings/lib/preferences";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

type PersistPreferencesCookieOptions = {
  persistent?: boolean;
};

function getBrowserStorage(persistent: boolean) {
  return persistent ? window.localStorage : window.sessionStorage;
}

function getInactiveBrowserStorage(persistent: boolean) {
  return persistent ? window.sessionStorage : window.localStorage;
}

export function persistPreferencesCookie(
  value: PersistedPreferences,
  options?: PersistPreferencesCookieOptions,
) {
  const persistent = options?.persistent ?? true;

  // biome-ignore lint/suspicious/noDocumentCookie: Browser-local settings persistence intentionally uses a cookie so server-rendered routes can read defaults too.
  document.cookie = [
    `${SETTINGS_COOKIE_NAME}=${serializePreferencesCookie(value)}`,
    "Path=/",
    "SameSite=Lax",
    ...(persistent ? [`Max-Age=${ONE_YEAR_IN_SECONDS}`] : []),
  ].join("; ");
}

export function persistSettingsStorageMode(persistent: boolean) {
  const activeStorage = getBrowserStorage(persistent);
  const inactiveStorage = getInactiveBrowserStorage(persistent);
  activeStorage.setItem(
    SETTINGS_PERSIST_MODE_STORAGE_KEY,
    persistent ? "persistent" : "session",
  );
  inactiveStorage.removeItem(SETTINGS_PERSIST_MODE_STORAGE_KEY);
}

export function getPersistedSettingsStorageMode() {
  if (
    window.localStorage.getItem(SETTINGS_PERSIST_MODE_STORAGE_KEY) ===
    "persistent"
  ) {
    return true;
  }

  if (
    window.sessionStorage.getItem(SETTINGS_PERSIST_MODE_STORAGE_KEY) ===
    "session"
  ) {
    return false;
  }

  return true;
}

export function persistUiLanguagePreference(
  language: string,
  persistent: boolean,
) {
  const activeStorage = getBrowserStorage(persistent);
  const inactiveStorage = getInactiveBrowserStorage(persistent);
  activeStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
  inactiveStorage.removeItem(UI_LANGUAGE_STORAGE_KEY);
}

export function readUiLanguagePreference() {
  return (
    window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY) ??
    window.sessionStorage.getItem(UI_LANGUAGE_STORAGE_KEY)
  );
}

function readCookieValue(name: string) {
  const prefix = `${name}=`;

  for (const part of document.cookie.split(";")) {
    const cookie = part.trim();

    if (cookie.startsWith(prefix)) {
      return cookie.slice(prefix.length);
    }
  }

  return undefined;
}

export function readPersistedPreferencesFromBrowser() {
  const rawValue = readCookieValue(SETTINGS_COOKIE_NAME);
  const preferences = parsePreferencesCookie(rawValue);

  if (preferencesCookieNeedsMigration(rawValue)) {
    persistPreferencesCookie(preferences, {
      persistent: getPersistedSettingsStorageMode(),
    });
  }

  return preferences;
}

export function broadcastSettingsSync() {
  window.dispatchEvent(new Event(SETTINGS_SYNC_EVENT));

  try {
    window.localStorage.setItem(SETTINGS_SYNC_STORAGE_KEY, `${Date.now()}`);
  } catch {
    // Storage can be unavailable or blocked; the same-tab event above remains a fallback.
  }
}
