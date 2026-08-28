import { getRequestConfig } from "next-intl/server";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import { defaultLocale, isAppLocale } from "@/i18n/config";

export default getRequestConfig(async () => {
  const preferences = await getPersistedPreferences();
  const requestedLocale = preferences.settings.uiLanguage;
  const locale = isAppLocale(requestedLocale) ? requestedLocale : defaultLocale;
  const messages =
    locale === "de"
      ? (await import("../../messages/de.json")).default
      : (await import("../../messages/en.json")).default;

  return {
    locale,
    messages,
  };
});
