"use client";

import { type CSSProperties, useEffect, useId, useMemo, useState } from "react";

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

export function SearxngVersionIndicator() {
  const tooltipId = useId();
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

  return (
    <button
      aria-describedby={tooltipId}
      aria-label={content.tooltip}
      className="group relative inline-flex max-w-full cursor-help items-center gap-2 border-0 bg-transparent p-0 text-xs font-medium text-foreground/65 outline-none transition-colors hover:text-foreground focus-visible:text-foreground dark:text-white/70 dark:hover:text-white dark:focus-visible:text-white"
      type="button"
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
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden max-w-72 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-sm group-hover:block group-focus-visible:block lg:left-0 lg:translate-x-0"
      >
        {content.tooltip}
      </span>
    </button>
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
      tooltip: "Latest version",
    };
  }

  if (status.state === "outdated") {
    return {
      dotClassName: "bg-red-500",
      label: `SearXNG ${currentVersion}`,
      ringColor: "rgb(239 68 68 / 0.18)",
      tooltip: `Update available: latest upstream is ${
        status.latestVersion ?? "unknown"
      }`,
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

function sanitizeVersion(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed || null;
}
