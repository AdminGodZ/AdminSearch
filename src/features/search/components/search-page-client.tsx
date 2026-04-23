"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Header } from "@/components/site/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Filters } from "@/features/search/components/filters";
import { ResultList } from "@/features/search/components/result-list";
import { SearchForm } from "@/features/search/components/search-form";
import { SearchTabs } from "@/features/search/components/search-tabs";
import { buildHref } from "@/features/search/lib/url-state";
import type { SearchResponse, SearchTab } from "@/features/search/types";
import {
  getSearchInterfacePreferences,
  getSearchPreferenceDefaults,
  type PersistedPreferences,
  SETTINGS_SYNC_EVENT,
  SETTINGS_SYNC_STORAGE_KEY,
  type SearchInterfacePreferences,
  type SearchPreferenceDefaults,
} from "@/features/settings/lib/preferences";
import { readPersistedPreferencesFromBrowser } from "@/features/settings/lib/preferences-client";
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
const sidebarCardClassName =
  "rounded-[28px] border-transparent bg-[var(--surface-panel)] ring-0 shadow-none";
const searchHeaderColumns = "lg:grid-cols-[132px_725px_minmax(0,1fr)]";
const searchContentColumns = "lg:grid-cols-[206px_minmax(0,1fr)]";

async function fetchSearchPageData(
  paramsString: string,
  page: number,
  signal: AbortSignal,
) {
  const params = new URLSearchParams(paramsString);

  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  const response = await fetch(`/api/search?${params.toString()}`, {
    signal,
    cache: "no-store",
  });

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "Search request failed.";

    throw new Error(message);
  }

  return payload as SearchResponse;
}

function mergeSearchResponses(current: SearchResponse, next: SearchResponse) {
  const seen = new Set(
    current.results.map((result) => result.id || result.url),
  );
  const mergedResults = [...current.results];

  for (const result of next.results) {
    const key = result.id || result.url;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    mergedResults.push(result);
  }

  return {
    ...current,
    page: next.page,
    totalResults: next.totalResults ?? current.totalResults,
    results: mergedResults,
    hasMore: next.hasMore,
  } satisfies SearchResponse;
}

function normalizeTab(value: string | null): SearchTab {
  switch (value) {
    case "images":
      return "images";
    case "videos":
      return "videos";
    case "news":
      return "news";
    default:
      return "all";
  }
}

function normalizeSafeSearch(value: string | null): 0 | 1 | 2 {
  if (value === "1") {
    return 1;
  }

  if (value === "2") {
    return 2;
  }

  return 0;
}

function normalizePage(value: string | null) {
  const page = Number(value ?? "1");
  return Number.isInteger(page) && page > 0 ? page : 1;
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

function formatResultCount(value?: number) {
  if (typeof value !== "number") {
    return undefined;
  }

  return new Intl.NumberFormat().format(value);
}

function formatRequestDuration(value?: number) {
  if (typeof value !== "number") {
    return undefined;
  }

  return `${(value / 1000).toFixed(2)}s`;
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
                className="group flex h-9 min-w-0 max-w-[220px] items-center gap-2 rounded-full border border-[var(--surface-chip-border)] bg-[var(--surface-panel)] pr-3.5 pl-1 text-left transition-colors hover:bg-accent"
              >
                <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--control-bg)]">
                  {thumbnailUrl ? (
                    // biome-ignore lint/performance/noImgElement: Suggestion thumbnails intentionally reuse current image search result thumbnails.
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
            aria-label="Scroll suggestions left"
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
            aria-label="Scroll suggestions"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SearchSidebar({
  data,
  openInNewTab,
  pathname,
  searchParams,
}: {
  data: SearchResponse;
  openInNewTab: boolean;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  if (!data.answers.length && !data.infoboxes.length) {
    return null;
  }

  return (
    <aside className="space-y-5">
      {data.answers.length ? (
        <Card className={sidebarCardClassName}>
          <CardContent className="space-y-3 p-6">
            <p className="text-xs tracking-[0.24em] text-[var(--text-soft)] uppercase">
              Quick Answer
            </p>
            {data.answers.map((answer) => (
              <p
                key={answer}
                className="text-sm leading-7 text-[var(--text-body)]"
              >
                {answer}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {data.infoboxes.map((infobox) => (
        <Card
          key={infobox.id}
          className={cn(sidebarCardClassName, "overflow-hidden")}
        >
          <CardContent className="space-y-6 p-7">
            {infobox.imageUrl ? (
              <div className="flex max-h-[240px] min-h-[160px] w-full items-center justify-center overflow-hidden rounded-2xl p-4">
                {/* biome-ignore lint/performance/noImgElement: Infobox images are remote SearXNG-provided media with dynamic origins. */}
                <img
                  src={infobox.imageUrl}
                  alt={infobox.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="max-h-[208px] w-full object-contain"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              {infobox.url ? (
                <a
                  href={infobox.url}
                  target={openInNewTab ? "_blank" : undefined}
                  rel={openInNewTab ? "noreferrer noopener" : undefined}
                  className="inline-flex hover:underline"
                >
                  <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-[var(--text-strong)]">
                    {infobox.title}
                  </h2>
                </a>
              ) : (
                <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-[var(--text-strong)]">
                  {infobox.title}
                </h2>
              )}
              {infobox.source ? (
                <p className="text-[13px] text-[var(--text-soft)]">
                  {infobox.source}
                </p>
              ) : null}
            </div>

            {infobox.content ? (
              <p className="text-[14px] leading-7 text-[var(--text-body)]">
                {infobox.content}
              </p>
            ) : null}

            {infobox.attributes.length ? (
              <div className="overflow-hidden rounded-2xl border border-border/40 divide-y divide-border/40">
                {infobox.attributes.map((attribute) => (
                  <div
                    key={`${infobox.id}-${attribute.label}`}
                    className="px-5 py-3.5"
                  >
                    <p className="text-[11px] font-medium tracking-[0.12em] text-[var(--text-soft)] uppercase">
                      {attribute.label}
                    </p>
                    {attribute.image ? (
                      // biome-ignore lint/performance/noImgElement: Infobox attribute images are remote SearXNG-provided media with dynamic origins.
                      <img
                        src={attribute.image.src}
                        alt={attribute.image.alt ?? attribute.label}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="mt-1.5 max-h-[140px] w-auto rounded-lg object-contain"
                      />
                    ) : null}
                    {attribute.value ? (
                      <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-body)]">
                        {attribute.value}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {infobox.urls.length ? (
              <div className="space-y-3 border-t border-border/40 pt-6">
                <p className="text-xs font-medium tracking-[0.16em] text-[var(--text-soft)] uppercase">
                  Links
                </p>
                <div className="flex flex-wrap gap-2">
                  {infobox.urls.map((urlEntry) => (
                    <a
                      key={`${infobox.id}-${urlEntry.url}`}
                      href={urlEntry.url}
                      target={openInNewTab ? "_blank" : undefined}
                      rel={openInNewTab ? "noreferrer noopener" : undefined}
                      className="rounded-full border border-[var(--surface-chip-border)] px-3.5 py-1.5 text-sm text-primary transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {urlEntry.title}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {infobox.relatedTopics.length ? (
              <div className="space-y-4 border-t border-border/40 pt-6">
                {infobox.relatedTopics.map((topic) => (
                  <div
                    key={`${infobox.id}-${topic.name}`}
                    className="space-y-2.5"
                  >
                    <p className="text-xs font-medium tracking-[0.16em] text-[var(--text-soft)] uppercase">
                      {topic.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {topic.suggestions.map((suggestion) => (
                        <Link
                          key={`${topic.name}-${suggestion}`}
                          href={buildHref(pathname, searchParams, {
                            q: suggestion,
                            page: null,
                          })}
                          className="rounded-full border border-[var(--surface-chip-border)] px-3 py-1.5 text-sm text-[var(--text-body)] transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {suggestion}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </aside>
  );
}

export function SearchPageClient({
  initialPreferences,
}: {
  initialPreferences: PersistedPreferences;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [loadedPage, setLoadedPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [imageTabSuggestions, setImageTabSuggestions] = useState<string[]>([]);
  const [preferences, setPreferences] =
    useState<PersistedPreferences>(initialPreferences);

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  useEffect(() => {
    function syncPreferencesFromBrowser() {
      setPreferences(readPersistedPreferencesFromBrowser());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === SETTINGS_SYNC_STORAGE_KEY) {
        syncPreferencesFromBrowser();
      }
    }

    window.addEventListener(SETTINGS_SYNC_EVENT, syncPreferencesFromBrowser);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        SETTINGS_SYNC_EVENT,
        syncPreferencesFromBrowser,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const defaults = useMemo<SearchPreferenceDefaults>(
    () => getSearchPreferenceDefaults(preferences.settings),
    [preferences.settings],
  );
  const interfacePreferences = useMemo<SearchInterfacePreferences>(
    () => getSearchInterfacePreferences(preferences.settings),
    [preferences.settings],
  );
  const runtimeRefreshKey = useMemo(
    () =>
      JSON.stringify({
        engines: {
          general: [...preferences.engines.general].sort(),
          images: [...preferences.engines.images].sort(),
          videos: [...preferences.engines.videos].sort(),
          news: [...preferences.engines.news].sort(),
        },
        imageProxy: preferences.settings.imageProxy,
        tokens: preferences.settings.engineTokens,
        plugins: {
          calculator: preferences.settings.calculator,
          doiRewrite: preferences.settings.doiRewrite,
          hashSearch: preferences.settings.hashSearch,
          selfInfo: preferences.settings.selfInfo,
          timeZone: preferences.settings.timeZone,
          trackerCleaner: preferences.settings.trackerCleaner,
          unitConverter: preferences.settings.unitConverter,
        },
        resultsPerPage: preferences.settings.loadMoreCount,
      }),
    [preferences.engines, preferences.settings],
  );

  const effectiveParams = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (!params.get("tab") && defaults.defaultTab !== "all") {
      params.set("tab", defaults.defaultTab);
    }

    if (!params.get("language") && defaults.language) {
      params.set("language", defaults.language);
    }

    if (!params.get("timeRange") && defaults.timeRange) {
      params.set("timeRange", defaults.timeRange);
    }

    if (!params.has("safeSearch") && defaults.safeSearch !== 0) {
      params.set("safeSearch", String(defaults.safeSearch));
    }

    return params;
  }, [
    defaults.defaultTab,
    defaults.language,
    defaults.safeSearch,
    defaults.timeRange,
    searchParams,
  ]);

  const queryStringWithoutPage = useMemo(() => {
    const params = new URLSearchParams(effectiveParams.toString());
    params.delete("page");
    return params.toString();
  }, [effectiveParams]);

  const currentQuery = effectiveParams.get("q")?.trim() ?? "";
  const currentTab = normalizeTab(effectiveParams.get("tab"));
  const requestedPage = normalizePage(searchParams.get("page"));
  const currentLanguage = effectiveParams.get("language")?.trim() || undefined;
  const currentTimeRange = useMemo(() => {
    const value = effectiveParams.get("timeRange");
    return value === "day" || value === "month" || value === "year"
      ? value
      : undefined;
  }, [effectiveParams]);
  const currentSafeSearch = effectiveParams.has("safeSearch")
    ? normalizeSafeSearch(effectiveParams.get("safeSearch"))
    : defaults.safeSearch;

  useEffect(() => {
    if (!interfacePreferences.queryInTitle || !currentQuery) {
      document.title = "AdminSearch - Search";
      return;
    }

    document.title = `AdminSearch - ${currentQuery}`;
  }, [currentQuery, interfacePreferences.queryInTitle]);

  useEffect(() => {
    const refreshMarker = runtimeRefreshKey;
    const params = new URLSearchParams(queryStringWithoutPage);
    const query = params.get("q")?.trim() ?? "";
    void refreshMarker;

    if (!query) {
      setState({ status: "idle" });
      setLoadedPage(1);
      return;
    }

    const controller = new AbortController();

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

        for (let page = 1; page <= requestedPage; page += 1) {
          const payload = await fetchSearchPageData(
            params.toString(),
            page,
            controller.signal,
          );

          aggregated = aggregated
            ? mergeSearchResponses(aggregated, payload)
            : payload;

          if (!payload.hasMore) {
            break;
          }
        }

        if (!aggregated) {
          throw new Error("Search request failed.");
        }

        setLoadedPage(aggregated.page);
        if (aggregated.tab === "all" && aggregated.suggestions.length > 0) {
          setImageTabSuggestions(aggregated.suggestions);
        }
        setState({
          status: "success",
          data: aggregated,
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        setState((previous) => ({
          status: "error",
          message:
            error instanceof Error ? error.message : "Search request failed.",
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

    return () => controller.abort();
  }, [
    currentQuery,
    currentTab,
    queryStringWithoutPage,
    requestedPage,
    runtimeRefreshKey,
  ]);

  useEffect(() => {
    if (!currentQuery) {
      setImageTabSuggestions([]);
    }
  }, [currentQuery]);

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

  const hasResults = Boolean(activeData?.results.length);
  const hasSidebarContent = Boolean(
    activeData && (activeData.answers.length || activeData.infoboxes.length),
  );
  const showLoadingFallback =
    currentQuery &&
    !activeData &&
    (state.status === "loading" || state.status === "success");
  const resultsSectionClass =
    currentTab === "images"
      ? ""
      : hasSidebarContent
        ? "max-w-[655px]"
        : "max-w-[655px]";
  const resultsLabel =
    currentTab === "images"
      ? "image results"
      : currentTab === "videos"
        ? "video results"
        : currentTab === "news"
          ? "news results"
          : "results";
  const visibleImageSuggestions =
    currentTab === "images" && activeData && activeData.suggestions.length > 0
      ? activeData.suggestions
      : imageTabSuggestions;

  async function handleLoadMore() {
    if (!activeData || !activeData.hasMore || isLoadingMore) {
      return;
    }

    const controller = new AbortController();
    const nextPage = activePage + 1;

    setIsLoadingMore(true);

    try {
      const nextPayload = await fetchSearchPageData(
        queryStringWithoutPage,
        nextPage,
        controller.signal,
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

        return {
          status: "success",
          data: mergeSearchResponses(current, nextPayload),
        };
      });
    } catch (error: unknown) {
      setState((previous) => ({
        status: "error",
        message:
          error instanceof Error ? error.message : "Search request failed.",
        previous:
          previous.status === "success"
            ? previous.data
            : previous.status === "loading" || previous.status === "error"
              ? previous.previous
              : activeData,
      }));
    } finally {
      setIsLoadingMore(false);
      controller.abort();
    }
  }

  return (
    <main className="w-full flex-1 bg-background px-5 py-8 sm:px-8 lg:px-10">
      <div className="space-y-8">
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
                  placeholder="Search AdminSearch"
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

        <div className="w-full">
          <div
            className={cn(
              "grid gap-7 lg:gap-x-5 lg:gap-y-7",
              currentTab !== "images" && searchContentColumns,
            )}
          >
            {currentTab !== "images" ? (
              <div className="hidden lg:block" />
            ) : null}
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
                    "xl:grid-cols-[minmax(0,882px)_minmax(320px,380px)]",
                )}
              >
                <div className="space-y-7 min-w-0">
                  {activeData ? (
                    <p
                      className={cn(
                        "text-sm text-[var(--text-soft-alt)]",
                        resultsSectionClass,
                      )}
                    >
                      {activeData.totalResults ? (
                        <>
                          About {formatResultCount(activeData.totalResults)}{" "}
                          total {resultsLabel}
                          {activeData.requestDurationMs ? (
                            <>
                              {" "}
                              (
                              {formatRequestDuration(
                                activeData.requestDurationMs,
                              )}
                              )
                            </>
                          ) : null}
                        </>
                      ) : (
                        <>
                          Showing {activeData.results.length} {resultsLabel}
                        </>
                      )}
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
                            Search error
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
                          <p className="text-xs tracking-[0.26em] text-[var(--text-soft)] uppercase">
                            Ready when you are
                          </p>
                          <p className="max-w-xl text-sm leading-7 text-[var(--text-body)]">
                            Start with a query, then switch between web, images,
                            videos, and news without leaving this page.
                          </p>
                        </div>
                        <Button
                          asChild
                          variant="brand"
                          className="rounded-full"
                        >
                          <Link href="/search?q=site%3Agithub.com+searxng+api&tab=all">
                            Try an example
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
                      />
                    </div>
                  ) : null}

                  {currentQuery && activeData && !hasResults ? (
                    <Card
                      variant="panel"
                      className={cn(panelCardClassName, resultsSectionClass)}
                    >
                      <CardContent className="space-y-3 p-6">
                        <p className="font-medium">No results found.</p>
                        <p className="text-sm leading-7 text-[var(--text-body)]">
                          Try a broader query, switch to another tab, or reduce
                          your filters.
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}

                  {activeData?.hasMore ? (
                    <div
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
                        aria-label="Load more results"
                      >
                        <ChevronDown
                          className={cn(
                            "size-5",
                            isLoadingMore && "animate-bounce",
                          )}
                        />
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
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
