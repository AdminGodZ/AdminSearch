"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SearxngStatusState = "latest" | "outdated" | "unknown";

type SearxngVersionStatus = {
  currentVersion: string | null;
  latestVersion: string | null;
  state: SearxngStatusState;
};

const initialStatus: SearxngVersionStatus = {
  currentVersion: null,
  latestVersion: null,
  state: "unknown",
};

const SEARXNG_COMMITS_URL = "https://github.com/searxng/searxng/commits/master";
const SEARXNG_GITHUB_URL = "https://github.com/searxng/searxng";

export function SearxngVersionIndicator() {
  const [hasChecked, setHasChecked] = useState(false);
  const [status, setStatus] = useState<SearxngVersionStatus>(initialStatus);

  useEffect(() => {
    const controller = new AbortController();

    async function readStatus() {
      try {
        const response = await fetch("/api/searxng/version", {
          signal: controller.signal,
        });

        if (!response.ok) {
          setHasChecked(true);
          return;
        }

        const nextStatus = (await response.json()) as SearxngVersionStatus;

        setHasChecked(true);
        setStatus({
          currentVersion: sanitizeVersion(nextStatus.currentVersion),
          latestVersion: sanitizeVersion(nextStatus.latestVersion),
          state:
            nextStatus.state === "latest" ||
            nextStatus.state === "outdated" ||
            nextStatus.state === "unknown"
              ? nextStatus.state
              : "unknown",
        });
      } catch {
        if (!controller.signal.aborted) {
          setHasChecked(true);
          setStatus(initialStatus);
        }
      }
    }

    readStatus();

    return () => controller.abort();
  }, []);

  const content = useMemo(
    () => getIndicatorContent(status, hasChecked),
    [hasChecked, status],
  );
  const changelogUrl = useMemo(() => getSearxngChangelogUrl(status), [status]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          aria-label={content.tooltip}
          className="inline-flex max-w-full items-center gap-2 text-xs font-medium text-foreground/65 underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline dark:text-white/70 dark:hover:text-white dark:focus-visible:text-white"
          href={changelogUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_var(--status-ring)]",
              content.dotClassName,
            )}
            style={
              {
                "--status-ring": content.ringColor,
              } as CSSProperties
            }
          />
          <span className="min-w-0 truncate">{content.label}</span>
        </a>
      </TooltipTrigger>
      <TooltipContent
        align="center"
        className="max-w-72 whitespace-nowrap"
        side="top"
        sideOffset={8}
      >
        {content.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function getIndicatorContent(
  status: SearxngVersionStatus,
  hasChecked: boolean,
) {
  const currentVersion = status.currentVersion ?? "unknown";

  if (status.state === "latest") {
    return {
      dotClassName: "bg-emerald-500",
      label: `SearXNG ${currentVersion}`,
      ringColor: "rgb(16 185 129 / 0.18)",
      tooltip: "Latest version.",
    };
  }

  if (status.state === "outdated") {
    return {
      dotClassName: "bg-red-500",
      label: `SearXNG ${currentVersion}`,
      ringColor: "rgb(239 68 68 / 0.18)",
      tooltip: `Update available: ${status.latestVersion ?? "unknown"}`,
    };
  }

  return {
    dotClassName: "bg-amber-400",
    label:
      status.currentVersion === null && !hasChecked
        ? "SearXNG checking"
        : `SearXNG ${currentVersion}`,
    ringColor: "rgb(251 191 36 / 0.2)",
    tooltip: hasChecked
      ? "Could not check latest upstream version"
      : "Checking latest upstream version",
  };
}

function getSearxngChangelogUrl(status: SearxngVersionStatus) {
  const currentCommit = getVersionCommit(status.currentVersion);
  const latestCommit = getVersionCommit(status.latestVersion);

  if (
    status.state === "outdated" &&
    currentCommit &&
    latestCommit &&
    currentCommit !== latestCommit
  ) {
    return `${SEARXNG_GITHUB_URL}/compare/${currentCommit}...${latestCommit}`;
  }

  if (currentCommit) {
    return `${SEARXNG_GITHUB_URL}/commit/${currentCommit}`;
  }

  return SEARXNG_COMMITS_URL;
}

function getVersionCommit(value: string | null | undefined) {
  return value?.trim().match(/[+-]([a-f0-9]{7,40})$/i)?.[1] ?? null;
}

function sanitizeVersion(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed || null;
}
