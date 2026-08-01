"use client";

import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const SUGGESTIONS_VIEWPORT_GUTTER_PX = 12;
const suggestionItemClassName =
  "flex w-full cursor-pointer items-center rounded-[1.1rem] px-4 py-3 text-left text-[15px] text-foreground transition-colors hover:bg-[var(--suggestion-hover)]";

type SearchSuggestionsProps = {
  highlightedIndex: number;
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onHighlight: (index: number) => void;
  onSelect: (suggestion: string) => void;
  suggestions: string[];
};

export function SearchSuggestions({
  highlightedIndex,
  id,
  inputRef,
  onHighlight,
  onSelect,
  suggestions,
}: SearchSuggestionsProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const suggestionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useLayoutEffect(() => {
    const visualViewport = window.visualViewport;
    const updateAvailableHeight = () => {
      const input = inputRef.current;
      const panel = panelRef.current;

      if (!input || !panel) {
        return;
      }

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
    window.addEventListener("scroll", updateAvailableHeight, {
      capture: true,
      passive: true,
    });
    visualViewport?.addEventListener("resize", updateAvailableHeight);
    visualViewport?.addEventListener("scroll", updateAvailableHeight, {
      passive: true,
    });

    return () => {
      window.removeEventListener("resize", updateAvailableHeight);
      window.removeEventListener("scroll", updateAvailableHeight, true);
      visualViewport?.removeEventListener("resize", updateAvailableHeight);
      visualViewport?.removeEventListener("scroll", updateAvailableHeight);
    };
  }, [inputRef]);

  // Scrolling the committed option is DOM synchronization, not derived state.
  // react-doctor-disable-next-line no-effect-chain
  useEffect(() => {
    if (highlightedIndex < 0) {
      return;
    }

    suggestionRefs.current[highlightedIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [highlightedIndex]);

  return (
    <div
      ref={panelRef}
      className="absolute top-[calc(100%-1px)] left-0 z-30 flex max-h-[var(--suggestions-available-height,24rem)] w-full flex-col overflow-hidden rounded-b-[1.75rem] bg-[var(--control-bg)] shadow-none [background-image:linear-gradient(var(--control-active),var(--control-active))]"
    >
      <div className="h-px w-full shrink-0 bg-[var(--surface-separator)]" />
      <div
        id={id}
        role="listbox"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
      >
        {suggestions.map((suggestion, index) => (
          <div key={suggestion}>
            <button
              ref={(element) => {
                suggestionRefs.current[index] = element;
              }}
              id={`${id}-item-${index}`}
              type="button"
              role="option"
              aria-selected={highlightedIndex === index}
              className={cn(
                suggestionItemClassName,
                highlightedIndex === index && "bg-[var(--suggestion-hover)]",
              )}
              onMouseEnter={() => onHighlight(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(suggestion);
              }}
            >
              {suggestion}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
