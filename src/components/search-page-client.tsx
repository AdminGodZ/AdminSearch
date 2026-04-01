"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Compass,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { Filters } from "@/components/filters";
import { ResultList } from "@/components/result-list";
import { SearchForm } from "@/components/search-form";
import { SearchTabs } from "@/components/search-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResponse, SearchTab } from "@/lib/search/types";
import { buildHref } from "@/lib/utils";

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

function normalizeTab(value: string | null): SearchTab {
  return value === "images" ? "images" : "all";
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
          <Card
            key={key}
            className="rounded-[28px] border-[var(--surface-panel-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow)]"
          >
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
        <Card
          key={key}
          className="rounded-[28px] border-[var(--surface-panel-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow)]"
        >
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

    fetch(`/api/search?${deferredParams.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
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
      })
      .then((data) => {
        setState({ status: "success", data });
      })
      .catch((error: unknown) => {
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
      });

    return () => controller.abort();
  }, [deferredQueryString]);

  const activeData =
    state.status === "success"
      ? state.data
      : state.status === "loading" || state.status === "error"
        ? state.previous
        : undefined;

  const hasResults = Boolean(activeData?.results.length);
  const showLoadingFallback = state.status === "loading" && !activeData;

  return (
    <main className="mx-auto min-h-screen max-w-[1180px] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium tracking-[0.34em] text-[var(--text-soft)] uppercase transition-colors hover:text-foreground"
        >
          <Compass className="size-4" />
          AdminSearch
        </Link>

        <Badge
          variant="outline"
          className="rounded-full border-[var(--surface-chip-border)] bg-background px-4 py-1 text-[11px] tracking-[0.24em] text-[var(--text-soft)] uppercase"
        >
          URL-driven search state
        </Badge>
      </div>

      <div className="space-y-7">
        <Card className="rounded-[30px] border-[var(--surface-panel-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shell-shadow)]">
          <CardContent className="space-y-6 p-6 sm:p-7 lg:p-8">
            <SearchForm
              action="/search"
              defaultQuery={currentQuery}
              tab={currentTab}
              language={currentLanguage}
              timeRange={currentTimeRange}
              safeSearch={currentSafeSearch}
            />

            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <SearchTabs tab={currentTab} />
              <Filters
                language={currentLanguage}
                timeRange={currentTimeRange}
                safeSearch={currentSafeSearch}
              />
            </div>
          </CardContent>
        </Card>

        {currentQuery ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.3em] text-[var(--text-soft)] uppercase">
                Query
              </p>
              <h1 className="mt-1 text-4xl font-semibold tracking-tight text-balance text-[var(--text-strong)]">
                {currentQuery}
              </h1>
            </div>

            {activeData ? (
              <p className="text-sm text-[var(--text-soft-alt)]">
                Showing {activeData.results.length} {currentTab} results on page{" "}
                {currentPage}
              </p>
            ) : null}
          </div>
        ) : null}

        {state.status === "error" ? (
          <Card className="rounded-[28px] border-destructive/20 bg-destructive/5 shadow-[0_1px_2px_rgba(28,31,38,0.04)]">
            <CardContent className="flex items-start gap-3 p-6">
              <AlertTriangle className="mt-0.5 size-4 text-destructive" />
              <div className="space-y-1">
                <p className="font-medium text-destructive">Search error</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {state.message}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!currentQuery ? (
          <Card className="rounded-[28px] border-[var(--surface-panel-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow)]">
            <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <p className="text-xs tracking-[0.26em] text-[var(--text-soft)] uppercase">
                  Ready when you are
                </p>
                <p className="max-w-xl text-sm leading-7 text-[var(--text-body)]">
                  Start with a query, then switch between web and image search
                  without leaving this page.
                </p>
              </div>
              <Button asChild className="rounded-full">
                <Link href="/search?q=site%3Agithub.com+searxng+api&tab=all">
                  Try an example
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : showLoadingFallback ? (
          <LoadingResults tab={currentTab} />
        ) : null}

        {activeData?.answers.length ? (
          <Card className="rounded-[28px] border-[var(--surface-panel-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-[var(--text-strong)]">
                <Sparkles className="size-4" />
                Instant answers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeData.answers.map((answer) => (
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

        {activeData?.suggestions.length ? (
          <Card className="rounded-[28px] border-[var(--surface-panel-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow)]">
            <CardContent className="flex flex-wrap items-center gap-2 p-6">
              <span className="mr-2 text-xs tracking-[0.26em] text-[var(--text-soft)] uppercase">
                Try next
              </span>
              {activeData.suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  asChild
                  variant="outline"
                  className="rounded-full border-[var(--surface-chip-border)] bg-background"
                >
                  <Link
                    href={buildHref(pathname, searchParams, {
                      q: suggestion,
                      page: null,
                    })}
                  >
                    {suggestion}
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {activeData && hasResults ? (
          <ResultList tab={currentTab} results={activeData.results} />
        ) : null}

        {currentQuery && activeData && !hasResults ? (
          <Card className="rounded-[28px] border-[var(--surface-panel-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow)]">
            <CardContent className="space-y-3 p-6">
              <p className="font-medium">No results found.</p>
              <p className="text-sm leading-7 text-[var(--text-body)]">
                Try a broader query, switch to another tab, or reduce your
                filters.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {activeData && (currentPage > 1 || activeData.hasMore) ? (
          <>
            <Separator className="my-2 bg-[var(--surface-separator)]" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              {currentPage > 1 ? (
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full border-[var(--surface-chip-border)] bg-background"
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
                  className="rounded-full border-[var(--surface-chip-border)] bg-background"
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
                  className="rounded-full bg-[var(--brand-button)] text-white hover:bg-[var(--brand-button-hover)] dark:text-[var(--primary-foreground)]"
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
                  className="rounded-full bg-[var(--brand-button)] text-white hover:bg-[var(--brand-button-hover)] dark:text-[var(--primary-foreground)]"
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
    </main>
  );
}
