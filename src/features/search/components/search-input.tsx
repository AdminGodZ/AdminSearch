"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { DashRing } from "@/components/loading-ui/dash-ring";
import { Input } from "@/components/ui/input";
import { SearchSuggestions } from "@/features/search/components/search-suggestions";
import { useAutocomplete } from "@/features/search/components/use-autocomplete";
import { SEARCH_QUERY_MAX_LENGTH } from "@/features/search/lib/limits";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  defaultValue: string;
  placeholder: string;
  size?: "hero" | "compact";
  className?: string;
  pending?: boolean;
};

const inputSizeClasses = {
  hero: "h-[55px] text-[18px] sm:text-[19px]",
  compact: "h-[52px] text-[16px]",
} as const;

export function SearchInput({
  defaultValue,
  placeholder,
  size = "compact",
  className,
  pending = false,
}: SearchInputProps) {
  const t = useTranslations("SearchInput");
  const inputId = useId();
  const suggestionsId = `${inputId}-suggestions`;
  const formRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const {
    clearSuggestions,
    closeSuggestions,
    highlightedIndex,
    highlightSuggestion,
    isOpen,
    moveHighlight,
    suggestions,
  } = useAutocomplete({ enabled: isFocused && !pending, query: value });

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!formRef.current?.contains(event.target as Node)) {
        closeSuggestions();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [closeSuggestions]);

  const applySuggestion = useCallback(
    (suggestion: string) => {
      setValue(suggestion);
      clearSuggestions();

      if (inputRef.current) {
        inputRef.current.value = suggestion;
        inputRef.current.blur();
        window.requestAnimationFrame(() => {
          inputRef.current?.form?.requestSubmit();
        });
      }
    },
    [clearSuggestions],
  );

  const showValueActions = value.length > 0;
  const isSuggestionsOpen = isOpen && suggestions.length > 0;

  return (
    <div ref={formRef} className="relative w-full">
      <label htmlFor={inputId} className="sr-only">
        {t("label")}
      </label>
      {pending ? (
        <DashRing className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-muted-foreground dark:text-white" />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-muted-foreground dark:text-white" />
      )}
      <Input
        ref={inputRef}
        id={inputId}
        name="q"
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          clearSuggestions();
        }}
        onFocus={() => {
          setIsFocused(true);
        }}
        onPointerDown={(event) => {
          const input = event.currentTarget;

          if (event.button !== 0 || value.length === 0) {
            return;
          }

          const paddingLeft = Number.parseFloat(
            window.getComputedStyle(input).paddingLeft,
          );
          const textStartX = input.getBoundingClientRect().left + paddingLeft;

          if (event.clientX > textStartX) {
            return;
          }

          event.preventDefault();
          input.focus({ preventScroll: true });

          const moveCaretToEnd = () => {
            const end = input.value.length;
            input.setSelectionRange(end, end);
          };

          moveCaretToEnd();
          window.requestAnimationFrame(moveCaretToEnd);
        }}
        onBlur={() => {
          setIsFocused(false);
          clearSuggestions();
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            return;
          }

          if (!suggestions.length) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            moveHighlight("next");
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            moveHighlight("previous");
            return;
          }

          if (event.key === "Escape") {
            closeSuggestions();
            return;
          }

          if (event.key === "Enter" && highlightedIndex >= 0) {
            event.preventDefault();
            applySuggestion(suggestions[highlightedIndex]);
          }
        }}
        placeholder={placeholder}
        maxLength={SEARCH_QUERY_MAX_LENGTH}
        className={cn(
          "rounded-full border-transparent bg-[var(--control-bg)] pr-12 pl-12 text-foreground shadow-none [transition-property:border-color,box-shadow,color,background-color] focus-visible:border-transparent focus-visible:ring-0 dark:text-white dark:placeholder:text-white/60",
          inputSizeClasses[size],
          className,
          isSuggestionsOpen
            ? "rounded-b-none rounded-t-[1.75rem] border-b border-b-[var(--surface-separator)] [background-image:linear-gradient(var(--control-active),var(--control-active))]"
            : "active:bg-[var(--control-hover)] focus:bg-[var(--control-active)] focus-visible:bg-[var(--control-active)]",
        )}
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={isSuggestionsOpen}
        aria-controls={isSuggestionsOpen ? suggestionsId : undefined}
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
              clearSuggestions();
            }}
            className="absolute top-1/2 right-3 z-10 inline-flex size-9 cursor-pointer items-center justify-center -translate-y-1/2 rounded-full text-muted-foreground transition-colors hover:bg-black/6 hover:text-foreground dark:text-white dark:hover:bg-white/8"
            aria-label={t("clear")}
          >
            <X className="size-5" />
          </button>
        </>
      ) : null}

      {isSuggestionsOpen ? (
        <SearchSuggestions
          highlightedIndex={highlightedIndex}
          id={suggestionsId}
          inputRef={inputRef}
          onHighlight={highlightSuggestion}
          onSelect={applySuggestion}
          suggestions={suggestions}
        />
      ) : null}
    </div>
  );
}
