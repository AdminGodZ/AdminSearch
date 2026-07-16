"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UI_LANGUAGE_STORAGE_KEY } from "@/features/settings/lib/preferences";
import {
  broadcastSettingsSync,
  getPersistedSettingsStorageMode,
  persistPreferencesCookie,
  persistUiLanguagePreference,
  readPersistedPreferencesFromBrowser,
  readUiLanguagePreference,
} from "@/features/settings/lib/preferences-client";
import {
  defaultLocale,
  type AppLocale,
  isAppLocale,
} from "@/i18n/config";
import { cn } from "@/lib/utils";

type LanguageSelectProps = {
  className?: string;
};

function persistLanguage(next: AppLocale) {
  const persistent = getPersistedSettingsStorageMode();
  const preferences = readPersistedPreferencesFromBrowser();

  persistPreferencesCookie(
    {
      ...preferences,
      settings: {
        ...preferences.settings,
        uiLanguage: next,
      },
    },
    { persistent },
  );
  persistUiLanguagePreference(next, persistent);
  broadcastSettingsSync();
}

export function LanguageSelect({ className }: LanguageSelectProps) {
  const locale = useLocale();
  const common = useTranslations("Common");
  const t = useTranslations("LanguageSelect");
  const router = useRouter();
  const activeLocale = isAppLocale(locale) ? locale : defaultLocale;
  const [language, setLanguage] = useState<AppLocale>(activeLocale);

  useEffect(() => {
    setLanguage(activeLocale);
    document.documentElement.lang = activeLocale;
  }, [activeLocale]);

  useEffect(() => {
    const saved = readUiLanguagePreference();

    if (saved && isAppLocale(saved) && saved !== activeLocale) {
      setLanguage(saved);
      persistLanguage(saved);
      document.documentElement.lang = saved;
      router.refresh();
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== UI_LANGUAGE_STORAGE_KEY) {
        return;
      }

      const stored = readUiLanguagePreference();

      if (stored && isAppLocale(stored)) {
        setLanguage(stored);
        document.documentElement.lang = stored;
        router.refresh();
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [activeLocale, router]);

  function onValueChange(value: string) {
    const next = isAppLocale(value) ? value : defaultLocale;

    setLanguage(next);
    persistLanguage(next);
    document.documentElement.lang = next;
    router.refresh();
  }

  return (
    <Select value={language} onValueChange={onValueChange}>
      <SelectTrigger
        variant="chrome"
        size="header"
        className={cn(
          "w-auto min-w-0 cursor-pointer justify-center gap-2 pl-4 pr-3 text-sm font-normal *:data-[slot=select-value]:flex-none",
          className,
        )}
        aria-label={t("label")}
      >
        <SelectValue>
          {common(`languages.${language}`)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="center" className="min-w-28 p-1">
        <SelectGroup className="p-0">
          <SelectItem value="en">{common("languages.en")}</SelectItem>
          <SelectItem value="de">{common("languages.de")}</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
