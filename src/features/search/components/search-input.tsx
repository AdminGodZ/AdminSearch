"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  defaultValue: string;
  placeholder: string;
  size?: "hero" | "compact";
  className?: string;
};

const inputSizeClasses = {
  hero: "h-[55px] text-[18px] sm:text-[19px]",
  compact: "h-[52px] text-[16px]",
} as const;

const suggestionItemClassName =
  "flex w-full cursor-pointer items-center rounded-[1.1rem] px-4 py-3 text-left text-[15px] text-foreground transition-colors hover:bg-[var(--suggestion-hover)]";
const AUTOCOMPLETE_DEBOUNCE_MS = 0;

export function SearchInput({
  defaultValue,
  placeholder,
  size = "compact",
  className,
}: SearchInputProps) {
  const inputId = useId();
  const suggestionsId = `${inputId}-suggestions`;
  const formRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setValue(defaultValue);
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
  }, [defaultValue]);

  useEffect(() => {
    if (value.trim().length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void (async () => {
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
          setHighlightedIndex(-1);
        } catch {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            setIsOpen(false);
            setHighlightedIndex(-1);
          }
        }
      })();
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [isFocused, value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!formRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function applySuggestion(suggestion: string) {
    setValue(suggestion);
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.value = suggestion;
      window.requestAnimationFrame(() => {
        inputRef.current?.form?.requestSubmit();
      });
    }
  }

  const showValueActions = hasMounted && value.length > 0;
  const isMergedOpen = isOpen && suggestions.length > 0;

  useEffect(() => {
    if (!isMergedOpen || highlightedIndex < 0) {
      return;
    }

    suggestionRefs.current[highlightedIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [highlightedIndex, isMergedOpen]);

  return (
    <div ref={formRef} className="relative w-full">
      <label htmlFor={inputId} className="sr-only">
        Search query
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-muted-foreground dark:text-white" />
      <Input
        ref={inputRef}
        id={inputId}
        name="q"
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setHighlightedIndex(-1);
        }}
        onFocus={() => {
          setIsFocused(true);
          setIsOpen(suggestions.length > 0);
        }}
        onBlur={() => {
          setIsFocused(false);
        }}
        onKeyDown={(event) => {
          if (!suggestions.length) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((prev) =>
              prev < suggestions.length - 1 ? prev + 1 : 0,
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((prev) =>
              prev > 0 ? prev - 1 : suggestions.length - 1,
            );
            return;
          }

          if (event.key === "Escape") {
            setIsOpen(false);
            setHighlightedIndex(-1);
            return;
          }

          if (event.key === "Enter" && highlightedIndex >= 0) {
            event.preventDefault();
            applySuggestion(suggestions[highlightedIndex]);
          }
        }}
        placeholder={placeholder}
        className={cn(
          "rounded-full border-transparent bg-[var(--control-bg)] pr-12 pl-12 text-foreground shadow-none [transition-property:border-color,box-shadow,color,background-color] active:bg-[var(--control-hover)] focus:bg-[var(--control-active)] focus-visible:border-transparent focus-visible:bg-[var(--control-active)] focus-visible:ring-0 dark:text-white dark:placeholder:text-white/60",
          inputSizeClasses[size],
          className,
          isMergedOpen &&
            "rounded-b-none rounded-t-[1.75rem] border-b border-b-[#ebebeb] bg-[var(--control-active)] dark:border-b-white/10 dark:bg-[var(--control-active)]",
        )}
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={isMergedOpen}
        aria-controls={isMergedOpen ? suggestionsId : undefined}
        aria-activedescendant={
          highlightedIndex >= 0
            ? `${suggestionsId}-item-${highlightedIndex}`
            : undefined
        }
      />
      {showValueActions ? (
        <>
          <span className="pointer-events-none absolute top-1/2 right-[55px] z-10 h-8 w-px -translate-y-1/2 bg-black/8 dark:bg-white/10" />
          <button
            type="button"
            onClick={() => {
              setValue("");
              setSuggestions([]);
              setIsOpen(false);
            }}
            className="absolute top-1/2 right-3 z-10 inline-flex size-9 cursor-pointer items-center justify-center -translate-y-1/2 rounded-full text-muted-foreground transition-colors hover:bg-black/6 hover:text-foreground dark:text-white dark:hover:bg-white/8"
            aria-label="Clear search"
          >
            <X className="size-5" />
          </button>
        </>
      ) : null}

      {isMergedOpen ? (
        <div className="absolute top-[calc(100%-1px)] left-0 z-30 w-full overflow-hidden rounded-b-[1.75rem] bg-[var(--control-active)] shadow-none dark:bg-[var(--control-active)]">
          <div className="h-px w-full bg-[#dddddd] dark:bg-white/10" />
          <div id={suggestionsId} role="listbox" className="p-2">
            {suggestions.map((suggestion, index) => (
              <div key={suggestion}>
                <button
                  ref={(element) => {
                    suggestionRefs.current[index] = element;
                  }}
                  id={`${suggestionsId}-item-${index}`}
                  type="button"
                  role="option"
                  aria-selected={highlightedIndex === index}
                  className={cn(
                    suggestionItemClassName,
                    highlightedIndex === index &&
                      "bg-[var(--suggestion-hover)]",
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applySuggestion(suggestion);
                  }}
                >
                  {suggestion}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
