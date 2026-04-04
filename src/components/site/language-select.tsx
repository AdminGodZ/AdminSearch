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

type Language = "en" | "de";

const STORAGE_KEY = "adminsearch-language";

export function LanguageSelect() {
  const [mounted, setMounted] = useState(false);
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    setMounted(true);

    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (saved === "en" || saved === "de") {
      setLanguage(saved);
      document.documentElement.lang = saved;
      return;
    }

    document.documentElement.lang = "en";
  }, []);

  function onValueChange(value: string) {
    const next = value === "de" ? "de" : "en";
    setLanguage(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }

  if (!mounted) {
    return (
      <div className="flex h-10 min-w-0 items-center justify-center gap-2 rounded-full border border-transparent bg-[var(--header-control-bg)] pl-4 pr-3 text-sm font-normal text-foreground shadow-none">
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
        className="w-auto min-w-0 cursor-pointer justify-center gap-2 pl-4 pr-3 text-sm font-normal *:data-[slot=select-value]:flex-none"
      >
        <SelectValue aria-label={language}>
          {language === "de" ? "German" : "English"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="center" className="min-w-28 p-1">
        <SelectGroup className="p-0">
          <SelectItem
            value="en"
            className="focus:bg-[#f4f4f5] focus:text-foreground dark:focus:bg-[#27272a]"
          >
            English
          </SelectItem>
          <SelectItem
            value="de"
            className="focus:bg-[#f4f4f5] focus:text-foreground dark:focus:bg-[#27272a]"
          >
            German
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
