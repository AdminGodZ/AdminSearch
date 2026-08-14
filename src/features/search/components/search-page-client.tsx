// biome-ignore-all lint/performance/noImgElement: Suggestion thumbnails reuse unbounded third-party search-result URLs.
"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  Suspense,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { DashRing } from "@/components/loading-ui/dash-ring";
import { Header } from "@/components/site/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AiOverviewCard } from "@/features/search/components/ai-overview-card";
import { Filters } from "@/features/search/components/filters";
import { ResultList } from "@/features/search/components/result-list";
import { SearchForm } from "@/features/search/components/search-form";
import { SearchInfoboxCard } from "@/features/search/components/search-infobox-card";
import { SearchTabs } from "@/features/search/components/search-tabs";
import { looksLikeCalculatorExpression } from "@/features/search/lib/calculator-query";
import { SEARCH_MAX_PAGE } from "@/features/search/lib/limits";
import {
  createSearchRequestKey,
  createSearchRuntimeKey,
} from "@/features/search/lib/request-key";
import { mergeSearchResponses } from "@/features/search/lib/response";
import {
  readSearchCache,
  writeSearchCache,
} from "@/features/search/lib/search-result-cache";
import {
  applySearchPreferenceDefaults,
  buildHref,
  normalizeSearchPage,
  normalizeSearchSafeSearch,
  normalizeSearchTab,
} from "@/features/search/lib/url-state";
import type {
  InitialSearchResult,
  SearchResponse,
  SearchTab,
} from "@/features/search/types";
import {
  getSearchInterfacePreferences,
  getSearchPreferenceDefaults,
  type PersistedPreferences,
  type SearchInterfacePreferences,
  type SearchPreferenceDefaults,
} from "@/features/settings/lib/preferences";
import { useSyncedPreferences } from "@/features/settings/lib/preferences-client";
import { cn } from "@/lib/utils";

type SearchState =
  | { status: "idle" }
  | { status: "loading"; previous?: SearchResponse }
  | { status: "success"; data: SearchResponse }
  | { status: "error"; message: string; previous?: SearchResponse };

const imageSkeletonKeys = Array.from(
  { length: 14 },
  (_, i) => `image-skeleton-${i + 1}`,
);

const resultSkeletonKeys = [
  "result-skeleton-1",
  "result-skeleton-2",
  "result-skeleton-3",
  "result-skeleton-4",
  "result-skeleton-5",
];

const panelCardClassName = "rounded-[28px]";
const emptyResultsCardClassName =
  "rounded-[28px] border border-[var(--surface-panel-border)] bg-[var(--surface-panel)] ring-0 shadow-none";
const answerCardClassName =
  "rounded-2xl border-transparent bg-[var(--surface-panel)] ring-0 shadow-none";
const searchHeaderColumns = "lg:grid-cols-[132px_725px_minmax(0,1fr)]";
const searchContentColumns = "lg:grid-cols-[206px_minmax(0,1fr)]";

async function fetchSearchPageData(
  paramsString: string,
  page: number,
  signal: AbortSignal,
  fallbackMessage: string,
  cursor?: string,
) {
  const params = new URLSearchParams(paramsString);

  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  if (cursor) {
    params.set("cursor", cursor);
  } else {
    params.delete("cursor");
  }

  // Success and error bodies are consumed only inside explicit response.ok branches.
  // react-doctor-disable-next-line no-fetch-response-used-without-status-check
  const response = await fetch(`/api/search?${params.toString()}`, {
    signal,
    cache: "no-store",
  });

  if (response.ok) {
    return (await response.json()) as SearchResponse;
  }

  const errorPayload: unknown = await response.json().catch(() => undefined);
  const message =
    errorPayload &&
    typeof errorPayload === "object" &&
    "message" in errorPayload &&
    typeof errorPayload.message === "string"
      ? errorPayload.message
      : fallbackMessage;

  throw new Error(message);
}

function LoadingResults({
  className,
  tab,
}: {
  className?: string;
  tab: SearchTab;
}) {
  if (tab === "images") {
    return (
      <div className="grid items-start grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6">
        {imageSkeletonKeys.map((key) => (
          <div key={key} className="self-start overflow-hidden rounded-xl">
            <Skeleton className="aspect-[16/10] w-full rounded-none" />
            <div className="min-h-[68px] space-y-1.5 px-2.5 py-2.5">
              <Skeleton className="h-2.5 w-1/3 rounded-full" />
              <Skeleton className="h-3 w-4/5 rounded-full" />
              <Skeleton className="h-3 w-3/5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-8", className)}>
      {resultSkeletonKeys.map((key) => (
        <div key={key} className="flex items-start gap-4 py-1">
          <Skeleton className="mt-1 size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24 rounded-full" />
              <Skeleton className="h-3 w-40 rounded-full" />
            </div>
            <Skeleton className="h-6 w-4/5 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-2/3 rounded-full" />
            </div>
            <Skeleton className="h-3 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function searchDataMatchesCurrentView(
  data: SearchResponse,
  tab: SearchTab,
  query: string,
) {
  return data.tab === tab && data.query.trim() === query;
}

function ImageSuggestionStrip({
  suggestions,
  thumbnails,
  pathname,
  searchParams,
}: {
  suggestions: string[];
  thumbnails: Array<string | undefined>;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const t = useTranslations("Search");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollLeftButton, setShowScrollLeftButton] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;

    if (!el) {
      return;
    }

    function check() {
      const container = scrollRef.current;

      if (!container) {
        return;
      }

      setShowScrollButton(
        container.scrollLeft + container.clientWidth <
          container.scrollWidth - 4,
      );
      setShowScrollLeftButton(container.scrollLeft > 4);
    }

    check();
    el.addEventListener("scroll", check, { passive: true });
    const observer = new ResizeObserver(check);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", check);
      observer.disconnect();
    };
  }, []);

  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex min-w-max gap-2.5 pr-12">
          {suggestions.slice(0, 16).map((suggestion, index) => {
            const thumbnailUrl = thumbnails[index];

            return (
              <Link
                key={suggestion}
                href={buildHref(pathname, searchParams, {
                  q: suggestion,
                  page: null,
                })}
                prefetch={false}
                className="group flex h-9 min-w-0 max-w-[220px] items-center gap-2 rounded-full border border-[var(--surface-chip-border)] bg-[var(--surface-panel)] pr-3.5 pl-1 text-left transition-colors hover:bg-accent"
              >
                <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--control-bg)]">
                  {thumbnailUrl ? (
                    // react-doctor-disable-next-line nextjs-no-img-element
                    <img
                      src={thumbnailUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <span className="truncate text-[13px] font-medium text-[var(--text-strong)] transition-colors group-hover:text-foreground">
                  {suggestion}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {showScrollLeftButton ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-20 items-center justify-start bg-gradient-to-r from-background from-40% to-transparent">
          <button
            type="button"
            className="pointer-events-auto flex size-9 cursor-pointer items-center justify-center rounded-full border border-[var(--surface-chip-border)] bg-background shadow-sm transition-colors hover:bg-accent"
            onClick={() =>
              scrollRef.current?.scrollBy({ left: -300, behavior: "smooth" })
            }
            aria-label={t("scrollSuggestionsLeft")}
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
      ) : null}

      {showScrollButton ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-20 items-center justify-end bg-gradient-to-l from-background from-40% to-transparent">
          <button
            type="button"
            className="pointer-events-auto flex size-9 cursor-pointer items-center justify-center rounded-full border border-[var(--surface-chip-border)] bg-background shadow-sm transition-colors hover:bg-accent"
            onClick={() =>
              scrollRef.current?.scrollBy({ left: 300, behavior: "smooth" })
            }
            aria-label={t("scrollSuggestionsRight")}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SearchAnswers({ answers }: { answers: string[] }) {
  if (!answers.length) {
    return null;
  }

  return (
    <Card className={`${answerCardClassName} gap-0 py-0`}>
      <CardContent className="space-y-1.5 px-5 py-3">
        {answers.map((answer) => (
          <p
            key={answer}
            className="text-base leading-6 text-[var(--text-body)]"
          >
            {answer}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

function SearchSidebar({
  data,
  openInNewTab,
  pathname,
  searchParams,
  showAiOverview,
}: {
  data: SearchResponse;
  openInNewTab: boolean;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
  showAiOverview: boolean;
}) {
  if (!showAiOverview && !data.infoboxes.length) {
    return null;
  }

  return (
    <aside className="space-y-5">
      {showAiOverview ? (
        <AiOverviewCard query={data.query} results={data.results} />
      ) : null}
      {data.infoboxes.map((infobox) => (
        <SearchInfoboxCard
          key={infobox.id}
          infobox={infobox}
          openInNewTab={openInNewTab}
          pathname={pathname}
          searchParams={searchParams}
        />
      ))}
    </aside>
  );
}

type UseSearchResultsOptions = {
  currentQuery: string;
  currentTab: SearchTab;
  currentLanguage?: string;
  currentTimeRange?: "day" | "month" | "year";
  currentSafeSearch: 0 | 1 | 2;
  runtimeRefreshKey: string;
  queryStringWithoutPage: string;
  requestedPage: number;
  resultReuseMode: SearchInterfacePreferences["resultReuseMode"];
  infiniteScroll: boolean;
  requestFailedMessage: string;
  initialData?: SearchResponse;
  initialError?: string;
  initialRequestKey?: string;
};

function useSearchResults({
  currentQuery,
  currentTab,
  currentLanguage,
  currentTimeRange,
  currentSafeSearch,
  runtimeRefreshKey,
  queryStringWithoutPage,
  requestedPage,
  resultReuseMode,
  infiniteScroll,
  requestFailedMessage,
  initialData,
  initialError,
  initialRequestKey,
}: UseSearchResultsOptions) {
  const requestKey = useMemo(
    () =>
      createSearchRequestKey(
        queryStringWithoutPage,
        requestedPage,
        runtimeRefreshKey,
      ),
    [queryStringWithoutPage, requestedPage, runtimeRefreshKey],
  );
  const hasMatchingInitialResult = initialRequestKey === requestKey;
  const [state, setState] = useState<SearchState>(() => {
    if (!currentQuery) {
      return { status: "idle" };
    }

    if (hasMatchingInitialResult && initialData) {
      return { status: "success", data: initialData };
    }

    if (hasMatchingInitialResult && initialError) {
      return { status: "error", message: initialError };
    }

    return { status: "loading" };
  });
  const [loadedPage, setLoadedPage] = useState(() =>
    hasMatchingInitialResult && initialData ? initialData.page : 1,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [imageTabSuggestions, setImageTabSuggestions] = useState<string[]>(
    () =>
      hasMatchingInitialResult &&
      initialData?.tab === "all" &&
      initialData.suggestions.length > 0
        ? initialData.suggestions
        : [],
  );
  const infiniteScrollSentinelRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);
  const searchCacheKey = useMemo(
    () =>
      JSON.stringify({
        query: currentQuery,
        tab: currentTab,
        language: currentLanguage ?? null,
        timeRange: currentTimeRange ?? null,
        safeSearch: currentSafeSearch,
        runtime: runtimeRefreshKey,
      }),
    [
      currentLanguage,
      currentQuery,
      currentSafeSearch,
      currentTab,
      currentTimeRange,
      runtimeRefreshKey,
    ],
  );

  // URL-driven searches use an abortable request and the user-selected cache policy.
  // react-doctor-disable-next-line no-fetch-in-effect, react-doctor/no-set-state-after-await-in-effect
  useEffect(() => {
    const params = new URLSearchParams(queryStringWithoutPage);
    const query = params.get("q")?.trim() ?? "";

    if (!query) {
      setState({ status: "idle" });
      setLoadedPage(1);
      return;
    }

    if (
      initialRequestKey === requestKey &&
      initialData &&
      searchDataMatchesCurrentView(initialData, currentTab, currentQuery)
    ) {
      setLoadedPage(initialData.page);
      if (initialData.tab === "all" && initialData.suggestions.length > 0) {
        setImageTabSuggestions(initialData.suggestions);
      }
      if (resultReuseMode === "cache") {
        writeSearchCache(resultReuseMode, searchCacheKey, initialData);
      }
      setState((previous) =>
        previous.status === "success" && previous.data === initialData
          ? previous
          : { status: "success", data: initialData },
      );
      return;
    }

    if (resultReuseMode === "cache") {
      const cachedData = readSearchCache(
        resultReuseMode,
        searchCacheKey,
        requestedPage,
      );

      if (cachedData) {
        setLoadedPage(cachedData.page);
        if (cachedData.tab === "all" && cachedData.suggestions.length > 0) {
          setImageTabSuggestions(cachedData.suggestions);
        }
        setState({
          status: "success",
          data: cachedData,
        });
        return;
      }
    }

    if (initialRequestKey === requestKey && initialError) {
      setLoadedPage(1);
      setState({ status: "error", message: initialError });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setState((previous) => ({
      status: "loading",
      previous:
        previous.status === "success" &&
        searchDataMatchesCurrentView(previous.data, currentTab, currentQuery)
          ? previous.data
          : (previous.status === "loading" || previous.status === "error") &&
              previous.previous &&
              searchDataMatchesCurrentView(
                previous.previous,
                currentTab,
                currentQuery,
              )
            ? previous.previous
            : undefined,
    }));

    void (async () => {
      try {
        let aggregated: SearchResponse | null = null;
        let nextPageCursor: string | undefined;

        for (let page = 1; page <= requestedPage; page += 1) {
          const payload = await fetchSearchPageData(
            params.toString(),
            page,
            controller.signal,
            requestFailedMessage,
            nextPageCursor,
          );

          aggregated = aggregated
            ? mergeSearchResponses(aggregated, payload)
            : payload;
          nextPageCursor = payload.nextPageCursor;

          if (!payload.hasMore) {
            break;
          }
        }

        if (!aggregated) {
          throw new Error(requestFailedMessage);
        }

        if (cancelled || controller.signal.aborted) {
          return;
        }

        setLoadedPage(aggregated.page);
        if (aggregated.tab === "all" && aggregated.suggestions.length > 0) {
          setImageTabSuggestions(aggregated.suggestions);
        }
        if (resultReuseMode === "cache") {
          writeSearchCache(resultReuseMode, searchCacheKey, aggregated);
        }
        setState({
          status: "success",
          data: aggregated,
        });
      } catch (error: unknown) {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        setState((previous) => ({
          status: "error",
          message:
            error instanceof Error ? error.message : requestFailedMessage,
          previous:
            previous.status === "success" &&
            searchDataMatchesCurrentView(
              previous.data,
              currentTab,
              currentQuery,
            )
              ? previous.data
              : (previous.status === "loading" ||
                    previous.status === "error") &&
                  previous.previous &&
                  searchDataMatchesCurrentView(
                    previous.previous,
                    currentTab,
                    currentQuery,
                  )
                ? previous.previous
                : undefined,
        }));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    currentQuery,
    currentTab,
    initialData,
    initialError,
    initialRequestKey,
    queryStringWithoutPage,
    requestKey,
    requestedPage,
    requestFailedMessage,
    resultReuseMode,
    searchCacheKey,
  ]);

  const activeData =
    state.status === "success" &&
    searchDataMatchesCurrentView(state.data, currentTab, currentQuery)
      ? state.data
      : (state.status === "loading" || state.status === "error") &&
          state.previous &&
          searchDataMatchesCurrentView(state.previous, currentTab, currentQuery)
        ? state.previous
        : undefined;
  const activePage = activeData?.page ?? loadedPage;
  const canLoadMore = Boolean(
    activeData?.hasMore && activePage < SEARCH_MAX_PAGE,
  );

  const handleLoadMore = useCallback(async () => {
    if (!activeData || !canLoadMore || isLoadingMoreRef.current) {
      return;
    }

    const controller = new AbortController();
    const nextPage = activePage + 1;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const nextPayload = await fetchSearchPageData(
        queryStringWithoutPage,
        nextPage,
        controller.signal,
        requestFailedMessage,
        activeData.nextPageCursor,
      );

      setLoadedPage(nextPayload.page);
      setState((previous) => {
        const current =
          previous.status === "success"
            ? previous.data
            : previous.status === "loading" || previous.status === "error"
              ? previous.previous
              : activeData;

        if (!current) {
          return previous;
        }

        const merged = mergeSearchResponses(current, nextPayload);

        if (resultReuseMode === "cache") {
          writeSearchCache(resultReuseMode, searchCacheKey, merged);
        }

        return {
          status: "success",
          data: merged,
        };
      });
    } catch (error: unknown) {
      setState((previous) => ({
        status: "error",
        message: error instanceof Error ? error.message : requestFailedMessage,
        previous:
          previous.status === "success"
            ? previous.data
            : previous.status === "loading" || previous.status === "error"
              ? previous.previous
              : activeData,
      }));
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
      controller.abort();
    }
  }, [
    activeData,
    activePage,
    canLoadMore,
    queryStringWithoutPage,
    requestFailedMessage,
    resultReuseMode,
    searchCacheKey,
  ]);

  useEffect(() => {
    if (!infiniteScroll || !canLoadMore || isLoadingMore) {
      return;
    }

    const sentinel = infiniteScrollSentinelRef.current;

    if (!sentinel) {
      return;
    }

    function maybeLoadMore() {
      const currentSentinel = infiniteScrollSentinelRef.current;

      if (!currentSentinel || isLoadingMoreRef.current) {
        return;
      }

      if (
        currentSentinel.getBoundingClientRect().top >
        window.innerHeight + 900
      ) {
        return;
      }

      void handleLoadMore();
    }

    let animationFrame: number | undefined;
    const scheduleLoadCheck = () => {
      if (animationFrame !== undefined) {
        return;
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = undefined;
        maybeLoadMore();
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isLoadingMoreRef.current) {
          return;
        }

        observer.disconnect();
        void handleLoadMore();
      },
      {
        rootMargin: "600px 0px",
      },
    );

    observer.observe(sentinel);
    scheduleLoadCheck();
    window.addEventListener("scroll", scheduleLoadCheck, { passive: true });
    window.addEventListener("resize", scheduleLoadCheck);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scheduleLoadCheck);
      window.removeEventListener("resize", scheduleLoadCheck);

      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [canLoadMore, handleLoadMore, infiniteScroll, isLoadingMore]);

  return {
    activeData,
    canLoadMore,
    handleLoadMore,
    imageTabSuggestions,
    infiniteScrollSentinelRef,
    isLoadingMore,
    state,
  };
}

type SearchRouteValues = {
  currentQuery: string;
  currentTab: SearchTab;
  currentLanguage?: string;
  currentTimeRange?: "day" | "month" | "year";
  currentSafeSearch: 0 | 1 | 2;
};

function SearchPageHeader({
  currentQuery,
  currentTab,
  currentLanguage,
  currentTimeRange,
  currentSafeSearch,
}: SearchRouteValues) {
  const t = useTranslations("Search");

  return (
    <section className="-mx-5 border-b border-border/70 px-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
      <div className="w-full">
        <div
          className={cn(
            "relative flex flex-col gap-5 lg:grid lg:items-center lg:gap-x-5 lg:gap-y-0",
            searchHeaderColumns,
          )}
        >
          <Link
            href="/"
            className="inline-flex h-12 items-center text-[24px] leading-none font-semibold tracking-tight text-foreground select-none sm:h-14 sm:text-[26px] lg:hidden"
          >
            AdminSearch
          </Link>

          <Link
            href="/"
            className="hidden lg:inline-flex lg:absolute lg:top-1/2 lg:left-0 lg:h-14 lg:-translate-y-1/2 lg:items-center lg:text-[26px] lg:leading-none lg:font-semibold lg:tracking-tight lg:text-foreground lg:select-none"
          >
            AdminSearch
          </Link>

          <div className="hidden lg:block" />

          <div className="min-w-0 w-full max-w-full lg:ml-[50px] lg:w-[725px]">
            <SearchForm
              action="/search"
              defaultQuery={currentQuery}
              tab={currentTab}
              language={currentLanguage}
              timeRange={currentTimeRange}
              safeSearch={currentSafeSearch}
              size="compact"
              variant="landing"
              placeholder={t("searchPlaceholder")}
            />
          </div>

          <Header className="hidden lg:flex lg:w-auto lg:justify-self-end" />
        </div>

        <div className="mt-5 w-full">
          <div
            className={cn(
              "grid gap-3 lg:gap-x-5 lg:gap-y-0",
              searchContentColumns,
            )}
          >
            <div className="hidden lg:block" />
            <SearchTabs
              tab={currentTab}
              trailingContent={
                <Filters
                  language={currentLanguage}
                  timeRange={currentTimeRange}
                  safeSearch={currentSafeSearch}
                />
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchResultsLoadingFallback({
  currentTab,
}: {
  currentTab: SearchTab;
}) {
  const resultsSectionClass = currentTab === "images" ? "" : "max-w-[655px]";

  return (
    <div className="w-full" aria-busy="true" data-search-results-loading="">
      <div
        className={cn(
          "grid gap-7 lg:gap-x-5 lg:gap-y-7",
          currentTab !== "images" && searchContentColumns,
        )}
      >
        {currentTab !== "images" ? <div className="hidden lg:block" /> : null}
        <div
          className={cn(
            "space-y-7 min-w-0",
            currentTab === "images" && "overflow-x-hidden",
          )}
        >
          <div className="grid items-start gap-7">
            <div className="space-y-7 min-w-0">
              <LoadingResults
                className={resultsSectionClass}
                tab={currentTab}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchResultsSection({
  calculatorAnswer,
  currentQuery,
  currentTab,
  interfacePreferences,
  searchResults,
}: {
  calculatorAnswer?: string;
  currentQuery: string;
  currentTab: SearchTab;
  interfacePreferences: SearchInterfacePreferences;
  searchResults: ReturnType<typeof useSearchResults>;
}) {
  const t = useTranslations("Search");
  const format = useFormatter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    activeData,
    canLoadMore,
    handleLoadMore,
    imageTabSuggestions,
    infiniteScrollSentinelRef,
    isLoadingMore,
    state,
  } = searchResults;
  const hasResults = Boolean(activeData?.results.length);
  const visibleAnswers = useMemo(
    () =>
      [...new Set([calculatorAnswer, ...(activeData?.answers ?? [])])].filter(
        (answer): answer is string => Boolean(answer),
      ),
    [activeData?.answers, calculatorAnswer],
  );
  const showAiOverview = Boolean(
    interfacePreferences.aiOverview &&
      activeData?.tab === "all" &&
      activeData.results.length > 0 &&
      activeData.infoboxes.length === 0,
  );
  const hasSidebarContent = Boolean(
    activeData?.infoboxes.length || showAiOverview,
  );
  const showLoadingFallback =
    currentQuery &&
    !activeData &&
    (state.status === "loading" || state.status === "success");
  const resultsSectionClass = currentTab === "images" ? "" : "max-w-[655px]";
  const resultsLabel =
    currentTab === "images"
      ? t("resultTypes.images")
      : currentTab === "videos"
        ? t("resultTypes.videos")
        : currentTab === "news"
          ? t("resultTypes.news")
          : t("resultTypes.all");
  const visibleImageSuggestions = !currentQuery
    ? []
    : currentTab === "images" && activeData && activeData.suggestions.length > 0
      ? activeData.suggestions
      : imageTabSuggestions;

  return (
    <div className="w-full">
      <div
        className={cn(
          "grid gap-7 lg:gap-x-5 lg:gap-y-7",
          currentTab !== "images" && searchContentColumns,
        )}
      >
        {currentTab !== "images" ? <div className="hidden lg:block" /> : null}
        <div
          className={cn(
            "space-y-7 min-w-0",
            currentTab === "images" && "overflow-x-hidden",
          )}
        >
          {currentTab === "images" && visibleImageSuggestions.length ? (
            <div className={cn("space-y-4", resultsSectionClass)}>
              <ImageSuggestionStrip
                suggestions={visibleImageSuggestions}
                thumbnails={(activeData?.results ?? [])
                  .slice(0, 16)
                  .map((result) => result.thumbnailUrl)}
                pathname={pathname}
                searchParams={searchParams}
              />
            </div>
          ) : null}

          <div
            className={cn(
              "grid items-start gap-7",
              hasSidebarContent &&
                currentTab !== "images" &&
                "xl:grid-cols-[minmax(0,882px)_minmax(320px,418px)]",
            )}
          >
            <div className="space-y-7 min-w-0">
              {visibleAnswers.length ? (
                <div className={resultsSectionClass}>
                  <SearchAnswers answers={visibleAnswers} />
                </div>
              ) : null}

              {activeData ? (
                <p
                  className={cn(
                    "text-sm text-[var(--text-soft-alt)]",
                    resultsSectionClass,
                  )}
                >
                  {activeData.requestDurationMs
                    ? t("showingWithDuration", {
                        count: activeData.results.length,
                        type: resultsLabel,
                        duration: format.number(
                          activeData.requestDurationMs / 1000,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        ),
                      })
                    : t("showing", {
                        count: activeData.results.length,
                        type: resultsLabel,
                      })}
                </p>
              ) : null}

              {state.status === "error" ? (
                <Card
                  className={cn(
                    "rounded-[28px] border-destructive/20 bg-destructive/5 shadow-[0_1px_2px_rgba(28,31,38,0.04)]",
                    resultsSectionClass,
                  )}
                >
                  <CardContent className="flex items-start gap-3 p-6">
                    <AlertTriangle className="mt-0.5 size-4 text-destructive" />
                    <div className="space-y-1">
                      <p className="font-medium text-destructive">
                        {t("errorTitle")}
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {state.message}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {!currentQuery ? (
                <Card
                  variant="panel"
                  className={cn("max-w-[882px]", panelCardClassName)}
                >
                  <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs text-[var(--text-soft)]">
                        {t("readyTitle")}
                      </p>
                      <p className="max-w-xl text-sm leading-7 text-[var(--text-body)]">
                        {t("readyDescription")}
                      </p>
                    </div>
                    <Button asChild variant="brand" className="rounded-full">
                      <Link
                        href="/search?q=site%3Agithub.com+searxng+api&tab=all"
                        prefetch={false}
                      >
                        {t("tryExample")}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : showLoadingFallback ? (
                <LoadingResults
                  className={resultsSectionClass}
                  tab={currentTab}
                />
              ) : null}

              {activeData && hasResults ? (
                <div className={resultsSectionClass}>
                  <ResultList
                    compactDensity={interfacePreferences.compactDensity}
                    faviconResolver={interfacePreferences.faviconResolver}
                    openInNewTab={interfacePreferences.openInNewTab}
                    showFavicons={interfacePreferences.showFavicons}
                    showThumbnails={interfacePreferences.showThumbnails}
                    tab={currentTab}
                    results={activeData.results}
                    urlFormatting={interfacePreferences.urlFormatting}
                  />
                </div>
              ) : null}

              {currentQuery &&
              activeData &&
              !hasResults &&
              !visibleAnswers.length &&
              !activeData.infoboxes.length ? (
                <Card
                  className={cn(emptyResultsCardClassName, resultsSectionClass)}
                >
                  <CardContent className="space-y-3 p-6">
                    <p className="font-medium">{t("noResults")}</p>
                    <p className="text-sm leading-7 text-[var(--text-body)]">
                      {t("noResultsDescription")}
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {canLoadMore ? (
                <div
                  ref={infiniteScrollSentinelRef}
                  className={cn(
                    "relative flex items-center",
                    resultsSectionClass,
                  )}
                >
                  <Separator className="flex-1 bg-[var(--surface-separator)]" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mx-4 size-10 shrink-0 cursor-pointer rounded-full border-transparent bg-[var(--control-bg)] shadow-none hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)] focus-visible:border-transparent focus-visible:bg-[var(--control-active)] dark:focus-visible:bg-[var(--control-active)] focus-visible:ring-0"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    aria-label={t("loadMore")}
                  >
                    {isLoadingMore ? (
                      <DashRing className="size-5 text-[#fff]" />
                    ) : (
                      <ChevronDown className="size-5" />
                    )}
                  </Button>
                  <Separator className="flex-1 bg-[var(--surface-separator)]" />
                </div>
              ) : null}
            </div>

            {activeData && currentTab !== "images" ? (
              <SearchSidebar
                data={activeData}
                openInNewTab={interfacePreferences.openInNewTab}
                pathname={pathname}
                searchParams={searchParams}
                showAiOverview={showAiOverview}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type SearchPageResultsProps = SearchRouteValues & {
  initialSearchPromise?: Promise<InitialSearchResult>;
  interfacePreferences: SearchInterfacePreferences;
  preferences: PersistedPreferences;
  queryStringWithoutPage: string;
  requestedPage: number;
  runtimeRefreshKey: string;
};

function SearchPageResults({
  currentQuery,
  currentTab,
  currentLanguage,
  currentTimeRange,
  currentSafeSearch,
  initialSearchPromise,
  interfacePreferences,
  preferences,
  queryStringWithoutPage,
  requestedPage,
  runtimeRefreshKey,
}: SearchPageResultsProps) {
  const initialSearch = initialSearchPromise
    ? use(initialSearchPromise)
    : undefined;
  const initialData =
    initialSearch?.status === "success" ? initialSearch.data : undefined;
  const initialError =
    initialSearch?.status === "error" ? initialSearch.message : undefined;
  const initialRequestKey = initialSearch?.requestKey;
  const t = useTranslations("Search");
  const [calculatorResult, setCalculatorResult] = useState<{
    answer?: string;
    query: string;
  }>();
  const searchResults = useSearchResults({
    currentQuery,
    currentTab,
    currentLanguage,
    currentTimeRange,
    currentSafeSearch,
    runtimeRefreshKey,
    queryStringWithoutPage,
    requestedPage,
    resultReuseMode: interfacePreferences.resultReuseMode,
    infiniteScroll: interfacePreferences.infiniteScroll,
    requestFailedMessage: t("requestFailed"),
    initialData,
    initialError,
    initialRequestKey,
  });

  useEffect(() => {
    if (
      !preferences.settings.calculator ||
      !looksLikeCalculatorExpression(currentQuery)
    ) {
      setCalculatorResult(undefined);
      return;
    }

    let cancelled = false;

    void import("@/features/search/lib/calculator")
      .then(({ calculateAnswer }) => {
        if (!cancelled) {
          setCalculatorResult({
            answer: calculateAnswer(currentQuery),
            query: currentQuery,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCalculatorResult({ query: currentQuery });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentQuery, preferences.settings.calculator]);

  const calculatorAnswer =
    preferences.settings.calculator && calculatorResult?.query === currentQuery
      ? calculatorResult.answer
      : undefined;

  return (
    <SearchResultsSection
      calculatorAnswer={calculatorAnswer}
      currentQuery={currentQuery}
      currentTab={currentTab}
      interfacePreferences={interfacePreferences}
      searchResults={searchResults}
    />
  );
}

export function SearchPageClient({
  initialPreferences,
  initialSearchPromise,
}: {
  initialPreferences: PersistedPreferences;
  initialSearchPromise?: Promise<InitialSearchResult>;
}) {
  const metadataT = useTranslations("Metadata");
  const searchParams = useSearchParams();
  const preferences = useSyncedPreferences(initialPreferences);
  const defaults = useMemo<SearchPreferenceDefaults>(
    () => getSearchPreferenceDefaults(preferences.settings),
    [preferences.settings],
  );
  const interfacePreferences = useMemo<SearchInterfacePreferences>(
    () => getSearchInterfacePreferences(preferences.settings),
    [preferences.settings],
  );
  const runtimeRefreshKey = useMemo(
    () => createSearchRuntimeKey(preferences),
    [preferences],
  );
  const effectiveParams = useMemo(() => {
    return applySearchPreferenceDefaults(searchParams, defaults);
  }, [defaults, searchParams]);
  const queryStringWithoutPage = useMemo(() => {
    const params = new URLSearchParams(effectiveParams.toString());
    params.delete("page");
    return params.toString();
  }, [effectiveParams]);
  const currentQuery = effectiveParams.get("q")?.trim() ?? "";
  const currentTab = normalizeSearchTab(effectiveParams.get("tab"));
  const requestedPage = normalizeSearchPage(searchParams.get("page"));
  const currentLanguage = effectiveParams.get("language")?.trim() || undefined;
  const currentTimeRange = useMemo(() => {
    const value = effectiveParams.get("timeRange");
    return value === "day" || value === "month" || value === "year"
      ? value
      : undefined;
  }, [effectiveParams]);
  const currentSafeSearch = effectiveParams.has("safeSearch")
    ? normalizeSearchSafeSearch(effectiveParams.get("safeSearch"))
    : defaults.safeSearch;
  const requestKey = useMemo(
    () =>
      createSearchRequestKey(
        queryStringWithoutPage,
        requestedPage,
        runtimeRefreshKey,
      ),
    [queryStringWithoutPage, requestedPage, runtimeRefreshKey],
  );

  useEffect(() => {
    if (!interfacePreferences.queryInTitle || !currentQuery) {
      document.title = `AdminSearch - ${metadataT("searchTitle")}`;
      return;
    }

    document.title = `AdminSearch - ${currentQuery}`;
  }, [currentQuery, interfacePreferences.queryInTitle, metadataT]);

  return (
    <main className="w-full flex-1 bg-background px-5 py-8 sm:px-8 lg:px-10">
      <div className="space-y-8">
        <SearchPageHeader
          currentQuery={currentQuery}
          currentTab={currentTab}
          currentLanguage={currentLanguage}
          currentTimeRange={currentTimeRange}
          currentSafeSearch={currentSafeSearch}
        />
        <Suspense
          key={requestKey}
          fallback={<SearchResultsLoadingFallback currentTab={currentTab} />}
        >
          <SearchPageResults
            currentQuery={currentQuery}
            currentTab={currentTab}
            currentLanguage={currentLanguage}
            currentTimeRange={currentTimeRange}
            currentSafeSearch={currentSafeSearch}
            initialSearchPromise={initialSearchPromise}
            interfacePreferences={interfacePreferences}
            preferences={preferences}
            queryStringWithoutPage={queryStringWithoutPage}
            requestedPage={requestedPage}
            runtimeRefreshKey={runtimeRefreshKey}
          />
        </Suspense>
      </div>
    </main>
  );
}
