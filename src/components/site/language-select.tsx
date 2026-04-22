"use client";

import { ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SETTINGS_SYNC_STORAGE_KEY,
  UI_LANGUAGE_EVENT,
  UI_LANGUAGE_STORAGE_KEY,
} from "@/features/settings/lib/preferences";
import {
  getPersistedSettingsStorageMode,
  persistUiLanguagePreference,
  readUiLanguagePreference,
} from "@/features/settings/lib/preferences-client";
import { cn } from "@/lib/utils";

type Language = "en" | "de";
type LanguageSelectProps = {
  className?: string;
};

export function LanguageSelect({ className }: LanguageSelectProps) {
  const [mounted, setMounted] = useState(false);
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    setMounted(true);

    function handleLanguageChange(event: Event) {
      const detail = (event as CustomEvent<{ language?: string }>).detail;
      const next = detail?.language === "de" ? "de" : "en";
      setLanguage(next);
      document.documentElement.lang = next;
    }

    function syncLanguageFromStorage() {
      const saved = readUiLanguagePreference();
      const next = saved === "de" ? "de" : "en";
      setLanguage(next);
      document.documentElement.lang = next;
    }

    function handleStorage(event: StorageEvent) {
      if (
        event.key === SETTINGS_SYNC_STORAGE_KEY ||
        event.key === UI_LANGUAGE_STORAGE_KEY
      ) {
        syncLanguageFromStorage();
      }
    }

    window.addEventListener(UI_LANGUAGE_EVENT, handleLanguageChange);
    window.addEventListener("storage", handleStorage);

    syncLanguageFromStorage();

    return () => {
      window.removeEventListener(UI_LANGUAGE_EVENT, handleLanguageChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function onValueChange(value: string) {
    const next = value === "de" ? "de" : "en";
    setLanguage(next);
    persistUiLanguagePreference(next, getPersistedSettingsStorageMode());
    document.documentElement.lang = next;
    window.dispatchEvent(
      new CustomEvent(UI_LANGUAGE_EVENT, {
        detail: { language: next },
      }),
    );
  }

  if (!mounted) {
    return (
      <div
        className={cn(
          "flex h-10 min-w-0 items-center justify-center gap-2 rounded-full border border-transparent bg-[var(--header-control-bg)] pl-4 pr-3 text-sm font-normal text-foreground shadow-none",
          className,
        )}
      >
        <span>English</span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
      </div>
    );
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
      >
        <SelectValue aria-label={language}>
          {language === "de" ? "German" : "English"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="center" className="min-w-28 p-1">
        <SelectGroup className="p-0">
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="de">German</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
