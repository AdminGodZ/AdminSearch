"use client";

import { Search, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LandingSearchInputProps = {
  defaultValue: string;
  placeholder: string;
};

export function LandingSearchInput({
  defaultValue,
  placeholder,
}: LandingSearchInputProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="relative w-full">
      <label htmlFor="search-query" className="sr-only">
        Search query
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="search-query"
        name="q"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="h-[50px] border-transparent bg-[var(--control-bg)] pr-12 pl-12 shadow-none [transition-property:border-color,box-shadow,color] focus:bg-[var(--control-active)] focus-visible:border-transparent focus-visible:bg-[var(--control-active)] focus-visible:ring-0"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setValue("")}
          className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-black/6 hover:text-foreground dark:hover:bg-white/8"
          aria-label="Clear search"
        >
          <X className="size-5" />
        </Button>
      ) : null}
    </div>
  );
}
