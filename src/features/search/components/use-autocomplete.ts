"use client";

import { useCallback, useEffect, useReducer } from "react";

import {
  AUTOCOMPLETE_DEBOUNCE_MS,
  createAutocompleteClient,
  normalizeAutocompleteQuery,
} from "@/features/search/lib/autocomplete-client";
import {
  AUTOCOMPLETE_MAX_QUERY_LENGTH,
  AUTOCOMPLETE_MAX_SUGGESTIONS,
  AUTOCOMPLETE_MIN_QUERY_LENGTH,
} from "@/features/search/lib/limits";

const autocompleteClient = createAutocompleteClient({
  maxQueryLength: AUTOCOMPLETE_MAX_QUERY_LENGTH,
  maxSuggestions: AUTOCOMPLETE_MAX_SUGGESTIONS,
  minQueryLength: AUTOCOMPLETE_MIN_QUERY_LENGTH,
});

type AutocompleteState = {
  highlightedIndex: number;
  isOpen: boolean;
  suggestions: string[];
};

type AutocompleteAction =
  | { type: "clear" }
  | { type: "close" }
  | { type: "highlight"; index: number }
  | { type: "move"; direction: "next" | "previous" }
  | { type: "received"; suggestions: string[] };

const initialAutocompleteState: AutocompleteState = {
  highlightedIndex: -1,
  isOpen: false,
  suggestions: [],
};

function autocompleteReducer(
  state: AutocompleteState,
  action: AutocompleteAction,
): AutocompleteState {
  switch (action.type) {
    case "clear":
      return initialAutocompleteState;
    case "close":
      return {
        ...state,
        highlightedIndex: -1,
        isOpen: false,
      };
    case "highlight":
      return {
        ...state,
        highlightedIndex: action.index,
      };
    case "move": {
      if (state.suggestions.length === 0) {
        return state;
      }

      const highlightedIndex =
        action.direction === "next"
          ? state.highlightedIndex < state.suggestions.length - 1
            ? state.highlightedIndex + 1
            : 0
          : state.highlightedIndex > 0
            ? state.highlightedIndex - 1
            : state.suggestions.length - 1;

      return {
        ...state,
        highlightedIndex,
        isOpen: true,
      };
    }
    case "received":
      return {
        highlightedIndex: -1,
        isOpen: action.suggestions.length > 0,
        suggestions: action.suggestions,
      };
  }
}

type UseAutocompleteOptions = {
  enabled: boolean;
  query: string;
};

export function useAutocomplete({ enabled, query }: UseAutocompleteOptions) {
  const [state, dispatch] = useReducer(
    autocompleteReducer,
    initialAutocompleteState,
  );
  const normalizedQuery = normalizeAutocompleteQuery(query);

  useEffect(() => {
    if (
      !enabled ||
      normalizedQuery.length < AUTOCOMPLETE_MIN_QUERY_LENGTH ||
      normalizedQuery.length > AUTOCOMPLETE_MAX_QUERY_LENGTH
    ) {
      return;
    }

    const cachedSuggestions =
      autocompleteClient.getCachedSuggestions(normalizedQuery);

    if (cachedSuggestions) {
      dispatch({ type: "received", suggestions: cachedSuggestions });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void autocompleteClient
        .requestSuggestions(normalizedQuery, controller.signal)
        .then((suggestions) => {
          if (!controller.signal.aborted) {
            dispatch({ type: "received", suggestions });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            dispatch({ type: "received", suggestions: [] });
          }
        });
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [enabled, normalizedQuery]);

  const clearSuggestions = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);
  const closeSuggestions = useCallback(() => {
    dispatch({ type: "close" });
  }, []);
  const highlightSuggestion = useCallback((index: number) => {
    dispatch({ type: "highlight", index });
  }, []);
  const moveHighlight = useCallback((direction: "next" | "previous") => {
    dispatch({ type: "move", direction });
  }, []);

  return {
    ...state,
    clearSuggestions,
    closeSuggestions,
    highlightSuggestion,
    moveHighlight,
  };
}
