"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { DashRing } from "@/components/loading-ui/dash-ring";
import { Input } from "@/components/ui/input";
import {
  AUTOCOMPLETE_MAX_SUGGESTIONS,
  SEARCH_QUERY_MAX_LENGTH,
} from "@/features/search/lib/limits";
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

const suggestionItemClassName =
  "flex w-full cursor-pointer items-center rounded-[1.1rem] px-4 py-3 text-left text-[15px] text-foreground transition-colors hover:bg-[var(--suggestion-hover)]";
const AUTOCOMPLETE_DEBOUNCE_MS = 0;
const AUTOCOMPLETE_MIN_QUERY_LENGTH = 2;
const SUGGESTIONS_VIEWPORT_GUTTER_PX = 12;

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
  const suggestionsPanelRef = useRef<HTMLDivElement>(null);
  const suggestionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    if (value.trim().length < AUTOCOMPLETE_MIN_QUERY_LENGTH) {
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

          const nextSuggestions = payload.suggestions
            .filter(
              (item): item is string =>
                typeof item === "string" && item.trim() !== "",
            )
            .slice(0, AUTOCOMPLETE_MAX_SUGGESTIONS);

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

  const showValueActions = value.length > 0;
  const isMergedOpen = isOpen && suggestions.length > 0;

  useLayoutEffect(() => {
    if (!isMergedOpen) {
      return;
    }

    const updateAvailableHeight = () => {
      const input = inputRef.current;
      const panel = suggestionsPanelRef.current;

      if (!input || !panel) {
        return;
      }

      const visualViewport = window.visualViewport;
      const viewportBottom = visualViewport
        ? visualViewport.offsetTop + visualViewport.height
        : window.innerHeight;
      const availableHeight = Math.max(
        0,
        Math.floor(
          viewportBottom -
            input.getBoundingClientRect().bottom -
            SUGGESTIONS_VIEWPORT_GUTTER_PX,
        ),
      );

      panel.style.setProperty(
        "--suggestions-available-height",
        `${availableHeight}px`,
      );
    };

    updateAvailableHeight();
    window.addEventListener("resize", updateAvailableHeight);
    window.addEventListener("scroll", updateAvailableHeight, true);
    window.visualViewport?.addEventListener("resize", updateAvailableHeight);
    window.visualViewport?.addEventListener("scroll", updateAvailableHeight);

    return () => {
      window.removeEventListener("resize", updateAvailableHeight);
      window.removeEventListener("scroll", updateAvailableHeight, true);
      window.visualViewport?.removeEventListener(
        "resize",
        updateAvailableHeight,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        updateAvailableHeight,
      );
    };
  }, [isMergedOpen]);

  // Scrolling the committed option is DOM synchronization, not derived state.
  // react-doctor-disable-next-line no-effect-chain
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
          setHighlightedIndex(-1);
        }}
        onFocus={() => {
          setIsFocused(true);
          setIsOpen(suggestions.length > 0);
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
        maxLength={SEARCH_QUERY_MAX_LENGTH}
        className={cn(
          "rounded-full border-transparent bg-[var(--control-bg)] pr-12 pl-12 text-foreground shadow-none [transition-property:border-color,box-shadow,color,background-color] focus-visible:border-transparent focus-visible:ring-0 dark:text-white dark:placeholder:text-white/60",
          inputSizeClasses[size],
          className,
          isMergedOpen
            ? "rounded-b-none rounded-t-[1.75rem] border-b border-b-[var(--surface-separator)] [background-image:linear-gradient(var(--control-active),var(--control-active))]"
            : "active:bg-[var(--control-hover)] focus:bg-[var(--control-active)] focus-visible:bg-[var(--control-active)]",
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
            aria-label={t("clear")}
          >
            <X className="size-5" />
          </button>
        </>
      ) : null}

      {isMergedOpen ? (
        <div
          ref={suggestionsPanelRef}
          className="absolute top-[calc(100%-1px)] left-0 z-30 flex max-h-[var(--suggestions-available-height,24rem)] w-full flex-col overflow-hidden rounded-b-[1.75rem] bg-[var(--control-bg)] shadow-none [background-image:linear-gradient(var(--control-active),var(--control-active))]"
        >
          <div className="h-px w-full shrink-0 bg-[var(--surface-separator)]" />
          <div
            id={suggestionsId}
            role="listbox"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
          >
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
