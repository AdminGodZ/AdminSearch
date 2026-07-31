"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { SearchForm } from "@/features/search/components/search-form";
import {
  getSearchPreferenceDefaults,
  type PersistedPreferences,
} from "@/features/settings/lib/preferences";
import { useSyncedPreferences } from "@/features/settings/lib/preferences-client";

export function HomeSearchFormClient({
  initialPreferences,
}: {
  initialPreferences: PersistedPreferences;
}) {
  const t = useTranslations("Home");
  const preferences = useSyncedPreferences(initialPreferences);

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
