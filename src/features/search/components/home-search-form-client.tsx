"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { SearchForm } from "@/features/search/components/search-form";
import {
  getSearchPreferenceDefaults,
  type PersistedPreferences,
  SETTINGS_SYNC_EVENT,
  SETTINGS_SYNC_STORAGE_KEY,
} from "@/features/settings/lib/preferences";
import { readPersistedPreferencesFromBrowser } from "@/features/settings/lib/preferences-client";

export function HomeSearchFormClient({
  initialPreferences,
}: {
  initialPreferences: PersistedPreferences;
}) {
  const t = useTranslations("Home");
  const [preferences, setPreferences] =
    useState<PersistedPreferences>(initialPreferences);

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  useEffect(() => {
    function syncPreferencesFromBrowser() {
      setPreferences(readPersistedPreferencesFromBrowser());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === SETTINGS_SYNC_STORAGE_KEY) {
        syncPreferencesFromBrowser();
      }
    }

    window.addEventListener(SETTINGS_SYNC_EVENT, syncPreferencesFromBrowser);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        SETTINGS_SYNC_EVENT,
        syncPreferencesFromBrowser,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const defaults = useMemo(
    () => getSearchPreferenceDefaults(preferences.settings),
    [preferences.settings],
  );

  return (
    <SearchForm
      action="/search"
      defaultQuery=""
      tab={defaults.defaultTab}
      language={defaults.language}
      timeRange={defaults.timeRange}
      safeSearch={defaults.safeSearch}
      size="hero"
      variant="landing"
      placeholder={t("searchPlaceholder")}
    />
  );
}
