"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

import {
  SETTINGS_SYNC_EVENT,
  SETTINGS_SYNC_STORAGE_KEY,
} from "@/features/settings/lib/preferences";
import {
  broadcastSettingsSync,
  getPersistedSettingsStorageMode,
  persistPreferencesCookie,
  readPersistedPreferencesFromBrowser,
} from "@/features/settings/lib/preferences-client";
import {
  applyColorTheme,
  isAppearanceMode,
} from "@/features/settings/lib/themes";

export function ThemePreferencesSync() {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    if (!theme || !isAppearanceMode(theme)) {
      return;
    }

    const preferences = readPersistedPreferencesFromBrowser();

    if (preferences.settings.theme === theme) {
      return;
    }

    persistPreferencesCookie(
      {
        ...preferences,
        settings: {
          ...preferences.settings,
          theme,
        },
      },
      {
        persistent: getPersistedSettingsStorageMode(),
      },
    );
    broadcastSettingsSync();
  }, [theme]);

  useEffect(() => {
    function applyPersistedColorTheme() {
      const preferences = readPersistedPreferencesFromBrowser();
      applyColorTheme(preferences.settings.colorTheme);
    }

    function syncPreferencesFromAnotherTab(event: StorageEvent) {
      if (event.key !== SETTINGS_SYNC_STORAGE_KEY) {
        return;
      }

      const preferences = readPersistedPreferencesFromBrowser();
      applyColorTheme(preferences.settings.colorTheme);
      setTheme(preferences.settings.theme);
    }

    window.addEventListener(SETTINGS_SYNC_EVENT, applyPersistedColorTheme);
    window.addEventListener("storage", syncPreferencesFromAnotherTab);

    return () => {
      window.removeEventListener(SETTINGS_SYNC_EVENT, applyPersistedColorTheme);
      window.removeEventListener("storage", syncPreferencesFromAnotherTab);
    };
  }, [setTheme]);

  return null;
}
