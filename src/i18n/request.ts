import { getRequestConfig } from "next-intl/server";

import {
  defaultLocale,
  isAppLocale,
} from "@/i18n/config";
import { getPersistedPreferences } from "@/features/settings/server/preferences";

export default getRequestConfig(async () => {
  const preferences = await getPersistedPreferences();
  const requestedLocale = preferences.settings.uiLanguage;
  const locale = isAppLocale(requestedLocale)
    ? requestedLocale
    : defaultLocale;
  const messages =
    locale === "de"
      ? (await import("../../messages/de.json")).default
      : (await import("../../messages/en.json")).default;

  return {
    locale,
    messages,
  };
});
