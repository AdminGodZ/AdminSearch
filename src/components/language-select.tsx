"use client";

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
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
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

  return (
    <Select value={language} onValueChange={onValueChange}>
      <SelectTrigger className="h-11 w-auto min-w-0 justify-center gap-2 rounded-full border-transparent bg-[var(--control-bg)] pl-4 pr-3 text-sm font-normal shadow-none [transition-property:border-color,box-shadow,color] hover:bg-[var(--control-hover)] focus-visible:border-transparent focus-visible:bg-[var(--control-active)] focus-visible:ring-0 *:data-[slot=select-value]:flex-none data-[state=open]:bg-[var(--control-active)]">
        <SelectValue aria-label={language}>
          {language === "de" ? "German" : "English"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end" className="min-w-28 p-1">
        <SelectGroup className="p-0">
          <SelectItem
            value="en"
            className="focus:bg-[var(--control-active)] focus:text-foreground"
          >
            English
          </SelectItem>
          <SelectItem
            value="de"
            className="focus:bg-[var(--control-active)] focus:text-foreground"
          >
            German
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
