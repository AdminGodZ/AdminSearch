"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createAiOverviewRequestBody,
  readAiOverviewText,
} from "@/features/search/lib/ai-overview";
import type { SearchResult } from "@/features/search/types";

type AiOverviewState =
  | { attempt: number; requestBody: string; status: "loading" }
  | { attempt: number; requestBody: string; status: "success"; text: string }
  | { attempt: number; requestBody: string; status: "error" };

export function AiOverviewCard({
  query,
  results,
}: {
  query: string;
  results: SearchResult[];
}) {
  const t = useTranslations("Search");
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<AiOverviewState>();
  const requestBody = useMemo(
    () => createAiOverviewRequestBody(query, results),
    [query, results],
  );

  // The overview is intentionally progressive so normal search results are never delayed by the AI service.
  // react-doctor-disable-next-line no-fetch-in-effect, react-doctor/no-set-state-after-await-in-effect
  useEffect(() => {
    if (!requestBody) {
      return;
    }

    const controller = new AbortController();
    setState({ attempt: retryCount, requestBody, status: "loading" });

    void (async () => {
      try {
        // Success and error payloads are consumed only after checking response.ok.
        // react-doctor-disable-next-line no-fetch-response-used-without-status-check
        const response = await fetch("/api/ai-overview", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: requestBody,
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("AI overview request failed");
        }

        const text = readAiOverviewText(await response.json());

        if (!text) {
          throw new Error("AI overview response was empty");
        }

        setState({
          attempt: retryCount,
          requestBody,
          status: "success",
          text,
        });
      } catch {
        if (!controller.signal.aborted) {
          setState({ attempt: retryCount, requestBody, status: "error" });
        }
      }
    })();

    return () => controller.abort();
  }, [requestBody, retryCount]);

  if (!requestBody) {
    return null;
  }

  const visibleState =
    state?.requestBody === requestBody && state.attempt === retryCount
      ? state
      : ({
          attempt: retryCount,
          requestBody,
          status: "loading",
        } satisfies AiOverviewState);

  return (
    <Card
      className="rounded-2xl border border-[var(--surface-panel-border)] bg-[var(--surface-ai-overview)] shadow-none ring-0"
      aria-busy={visibleState.status === "loading"}
    >
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles aria-hidden="true" className="size-4" />
          </span>
          <h2 className="text-[15px] font-semibold text-[var(--text-strong)]">
            {t("aiOverviewTitle")}
          </h2>
        </div>

        {visibleState.status === "loading" ? (
          <div className="space-y-3" role="status" aria-live="polite">
            <p className="text-[13px] text-[var(--text-soft)]">
              {t("aiOverviewGenerating")}
            </p>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-full rounded-full" />
              <Skeleton className="h-3.5 w-[92%] rounded-full" />
              <Skeleton className="h-3.5 w-3/4 rounded-full" />
            </div>
          </div>
        ) : null}

        {visibleState.status === "success" ? (
          <>
            <p className="whitespace-pre-wrap text-[14px] leading-6 text-[var(--text-body)]">
              {visibleState.text}
            </p>
            <p className="border-t border-[var(--surface-separator)] pt-3 text-[11.5px] leading-5 text-[var(--text-soft)]">
              {t("aiOverviewDisclaimer")}
            </p>
          </>
        ) : null}

        {visibleState.status === "error" ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-5 text-[var(--text-soft)]">
              {t("aiOverviewUnavailable")}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 rounded-full"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              {t("aiOverviewRetry")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
