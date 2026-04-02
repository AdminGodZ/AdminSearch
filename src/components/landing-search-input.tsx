"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LandingSearchInputProps = {
  defaultValue: string;
  placeholder: string;
  className?: string;
};

export function LandingSearchInput({
  defaultValue,
  placeholder,
  className,
}: LandingSearchInputProps) {
  const inputId = useId();
  const formRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setValue(defaultValue);
    setIsOpen(false);
    setSuggestions([]);
  }, [defaultValue]);

  useEffect(() => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/autocomplete?q=${encodeURIComponent(value.trim())}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          setSuggestions([]);
          setIsOpen(false);
          return;
        }

        const payload: unknown = await response.json();

        if (
          !payload ||
          typeof payload !== "object" ||
          !("suggestions" in payload) ||
          !Array.isArray(payload.suggestions)
        ) {
          setSuggestions([]);
          setIsOpen(false);
          return;
        }

        const nextSuggestions = payload.suggestions.filter(
          (item): item is string =>
            typeof item === "string" && item.trim() !== "",
        );

        setSuggestions(nextSuggestions);
        setIsOpen(isFocused && nextSuggestions.length > 0);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setIsOpen(false);
        }
      }
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [isFocused, value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!formRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function applySuggestion(suggestion: string) {
    setValue(suggestion);
    setIsOpen(false);
    setSuggestions([]);
    if (inputRef.current) {
      inputRef.current.value = suggestion;
      window.requestAnimationFrame(() => {
        inputRef.current?.form?.requestSubmit();
      });
    }
  }

  const showValueActions = hasMounted && value.length > 0;
  const isMergedOpen = isOpen && suggestions.length > 0;

  return (
    <div ref={formRef} className="relative w-full">
      <label htmlFor={inputId} className="sr-only">
        Search query
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        id={inputId}
        name="q"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => {
          setIsFocused(true);
          setIsOpen(suggestions.length > 0);
        }}
        onBlur={() => {
          setIsFocused(false);
        }}
        placeholder={placeholder}
        className={cn(
          "h-[50px] border-transparent bg-[var(--control-bg)] pr-12 pl-12 text-foreground shadow-none [transition-property:border-color,box-shadow,color] focus:bg-[var(--control-active)] focus-visible:border-transparent focus-visible:bg-[var(--control-active)] focus-visible:ring-0 dark:text-white dark:placeholder:text-white/60",
          isMergedOpen &&
            "rounded-b-none rounded-t-[1.75rem] border-b border-b-[#ebebeb] bg-[var(--control-active)] dark:border-b-border dark:bg-[var(--control-active)]",
          className,
        )}
        autoComplete="off"
        spellCheck={false}
      />
      {showValueActions ? (
        <>
          <span className="pointer-events-none absolute top-1/2 right-12 z-10 h-8 w-px -translate-y-1/2 bg-black/8 dark:bg-white/10" />
          <button
            type="button"
            onClick={() => {
              setValue("");
              setSuggestions([]);
              setIsOpen(false);
            }}
            className="absolute top-1/2 right-2 z-10 inline-flex size-9 cursor-pointer items-center justify-center -translate-y-1/2 rounded-full text-muted-foreground transition-colors hover:bg-black/6 hover:text-foreground dark:hover:bg-white/8"
            aria-label="Clear search"
          >
            <X className="size-5" />
          </button>
        </>
      ) : null}

      {isMergedOpen ? (
        <div className="absolute top-[calc(100%-1px)] left-0 z-30 w-full overflow-hidden rounded-b-[1.75rem] bg-[var(--control-active)] shadow-none dark:bg-[var(--control-active)]">
          <div className="h-px w-full bg-[#dddddd] dark:bg-[#30343d]" />
          <ul className="p-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  className="flex w-full items-center rounded-[1.1rem] px-4 py-3 text-left text-[15px] text-foreground transition-colors hover:bg-[#f8f8f8] dark:hover:bg-[#31343b]"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applySuggestion(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
