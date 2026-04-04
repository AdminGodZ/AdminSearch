"use client";

import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

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
import { cn } from "@/lib/utils";

type SearchState =
  | { status: "idle" }
  | { status: "loading"; previous?: SearchResponse }
  | { status: "success"; data: SearchResponse }
  | { status: "error"; message: string; previous?: SearchResponse };

const imageSkeletonKeys = [
  "image-skeleton-1",
  "image-skeleton-2",
  "image-skeleton-3",
  "image-skeleton-4",
  "image-skeleton-5",
  "image-skeleton-6",
];

const resultSkeletonKeys = [
  "result-skeleton-1",
  "result-skeleton-2",
  "result-skeleton-3",
  "result-skeleton-4",
  "result-skeleton-5",
];

const MAX_VISIBLE_SUGGESTIONS = 8;
const panelCardClassName = "rounded-[28px]";
const paginationButtonClassName =
  "rounded-full border-[var(--surface-chip-border)] bg-background";
const sidebarCardClassName =
  "rounded-[28px] border border-[var(--surface-panel-border)] bg-[var(--surface-panel)] ring-0 shadow-none";
const searchHeaderColumns = "lg:grid-cols-[132px_725px_minmax(0,1fr)]";
const searchContentColumns = "lg:grid-cols-[206px_minmax(0,1fr)]";

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

function LoadingResults({ tab }: { tab: SearchTab }) {
  if (tab === "images") {
    return (
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {imageSkeletonKeys.map((key) => (
          <Card key={key} variant="panel" className="rounded-[28px]">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="aspect-[4/3] w-full rounded-[22px]" />
              <Skeleton className="h-4 w-4/5 rounded-full" />
              <Skeleton className="h-3 w-1/2 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {resultSkeletonKeys.map((key) => (
        <Card key={key} variant="panel" className="rounded-[28px]">
          <CardContent className="space-y-4 p-7 sm:p-8">
            <Skeleton className="h-3 w-1/4 rounded-full" />
            <Skeleton className="h-10 w-3/4 rounded-full" />
            <Skeleton className="h-5 w-full rounded-full" />
            <Skeleton className="h-5 w-2/3 rounded-full" />
          </CardContent>
        </Card>
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

function SearchSidebar({
  data,
  pathname,
  searchParams,
}: {
  data: SearchResponse;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  if (!data.answers.length && !data.infoboxes.length) {
    return null;
  }

  return (
    <aside className="space-y-5 xl:sticky xl:top-8">
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
              // biome-ignore lint/performance/noImgElement: Infobox images are remote SearXNG-provided media with dynamic origins.
              <img
                src={infobox.imageUrl}
                alt={infobox.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="max-h-[240px] w-full rounded-2xl object-cover"
              />
            ) : null}
            <div className="space-y-1.5">
              <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-[var(--text-strong)]">
                {infobox.title}
              </h2>
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
                      target="_blank"
                      rel="noreferrer noopener"
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

export function SearchPageClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<SearchState>({ status: "idle" });

  const queryString = searchParams.toString();
  const deferredQueryString = useDeferredValue(queryString);

  const currentQuery = searchParams.get("q")?.trim() ?? "";
  const currentTab = normalizeTab(searchParams.get("tab"));
  const currentPage = normalizePage(searchParams.get("page"));
  const currentLanguage = searchParams.get("language")?.trim() || undefined;
  const currentTimeRange = useMemo(() => {
    const value = searchParams.get("timeRange");
    return value === "day" || value === "month" || value === "year"
      ? value
      : undefined;
  }, [searchParams]);
  const currentSafeSearch = normalizeSafeSearch(searchParams.get("safeSearch"));

  useEffect(() => {
    const deferredParams = new URLSearchParams(deferredQueryString);
    const deferredQuery = deferredParams.get("q")?.trim() ?? "";

    if (!deferredQuery) {
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();

    setState((previous) => ({
      status: "loading",
      previous:
        previous.status === "success"
          ? previous.data
          : previous.status === "loading" || previous.status === "error"
            ? previous.previous
            : undefined,
    }));

    void (async () => {
      try {
        const response = await fetch(
          `/api/search?${deferredParams.toString()}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );
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

        setState({
          status: "success",
          data: payload as SearchResponse,
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
            previous.status === "success"
              ? previous.data
              : previous.status === "loading" || previous.status === "error"
                ? previous.previous
                : undefined,
        }));
      }
    })();

    return () => controller.abort();
  }, [deferredQueryString]);

  const activeData =
    state.status === "success"
      ? state.data
      : state.status === "loading" || state.status === "error"
        ? state.previous
        : undefined;

  const hasResults = Boolean(activeData?.results.length);
  const hasSidebarContent = Boolean(
    activeData && (activeData.answers.length || activeData.infoboxes.length),
  );
  const showLoadingFallback = state.status === "loading" && !activeData;
  const resultsSectionClass =
    currentTab === "images"
      ? "max-w-[1280px]"
      : hasSidebarContent
        ? "w-full"
        : "max-w-[980px]";
  const resultsLabel =
    currentTab === "images"
      ? "image results"
      : currentTab === "videos"
        ? "video results"
        : currentTab === "news"
          ? "news results"
          : "results";

  return (
    <main className="w-full flex-1 px-5 py-8 sm:px-8 lg:px-10">
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
                <div className="flex min-h-11 w-full max-w-full flex-wrap items-end gap-x-10 gap-y-2">
                  <SearchTabs tab={currentTab} />
                  <Filters
                    language={currentLanguage}
                    timeRange={currentTimeRange}
                    safeSearch={currentSafeSearch}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="w-full">
          <div
            className={cn(
              "grid gap-7 lg:gap-x-5 lg:gap-y-7",
              searchContentColumns,
            )}
          >
            <div className="hidden lg:block" />
            <div className="space-y-7">
              <div
                className={cn(
                  "grid items-start gap-7",
                  hasSidebarContent &&
                    currentTab !== "images" &&
                    "xl:grid-cols-[minmax(0,980px)_minmax(320px,380px)]",
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
                      className={cn("max-w-[980px]", panelCardClassName)}
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
                    <LoadingResults tab={currentTab} />
                  ) : null}

                  {activeData?.suggestions.length ? (
                    <div className={cn("space-y-3", resultsSectionClass)}>
                      <span className="block text-xs tracking-[0.26em] text-[var(--text-soft)] uppercase">
                        Try next
                      </span>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {activeData.suggestions
                          .slice(0, MAX_VISIBLE_SUGGESTIONS)
                          .map((suggestion) => (
                            <Link
                              key={suggestion}
                              href={buildHref(pathname, searchParams, {
                                q: suggestion,
                                page: null,
                              })}
                              className="max-w-full truncate text-sm text-[var(--text-body)] transition-colors hover:text-foreground hover:underline"
                            >
                              {suggestion}
                            </Link>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {activeData && hasResults ? (
                    <div className={resultsSectionClass}>
                      <ResultList
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

                  {activeData && (currentPage > 1 || activeData.hasMore) ? (
                    <>
                      <div className={resultsSectionClass}>
                        <Separator className="my-2 bg-[var(--surface-separator)]" />
                      </div>
                      <div
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3",
                          resultsSectionClass,
                        )}
                      >
                        {currentPage > 1 ? (
                          <Button
                            asChild
                            variant="outline"
                            className={paginationButtonClassName}
                          >
                            <Link
                              href={buildHref(pathname, searchParams, {
                                page: currentPage - 1,
                              })}
                            >
                              <ArrowLeft className="size-4" />
                              Previous
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className={paginationButtonClassName}
                            disabled
                          >
                            <ArrowLeft className="size-4" />
                            Previous
                          </Button>
                        )}

                        <p className="text-xs tracking-[0.24em] text-[var(--text-soft)] uppercase">
                          Page {currentPage}
                        </p>

                        {activeData.hasMore ? (
                          <Button
                            asChild
                            variant="brand"
                            className="rounded-full"
                          >
                            <Link
                              href={buildHref(pathname, searchParams, {
                                page: currentPage + 1,
                              })}
                            >
                              Next
                              <ArrowRight className="size-4" />
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="brand"
                            className="rounded-full"
                            disabled
                          >
                            Next
                            <ArrowRight className="size-4" />
                          </Button>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>

                {activeData && currentTab !== "images" ? (
                  <SearchSidebar
                    data={activeData}
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
