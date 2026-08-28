// biome-ignore-all lint/performance/noImgElement: Video thumbnails use unbounded third-party URLs supplied by SearXNG.
"use client";

import { useTranslations } from "next-intl";
import { memo } from "react";
import { SiteFavicon } from "@/features/search/components/site-favicon";
import { formatResultEngineNames } from "@/features/search/lib/result-engines";
import type { SearchResult } from "@/features/search/types";
import type { UrlFormattingMode } from "@/features/settings/lib/preferences";
import { cn } from "@/lib/utils";

type VideoResultCardProps = {
  compactDensity?: boolean;
  faviconResolver?: string;
  openInNewTab?: boolean;
  result: SearchResult;
  showFavicons?: boolean;
  showThumbnails?: boolean;
  urlFormatting?: UrlFormattingMode;
};

function getResultMeta(result: SearchResult, faviconResolver: string) {
  const fallback = {
    host: result.source ?? result.displayUrl ?? result.url,
    path: "",
    protocol: "https:",
    faviconUrl: undefined as string | undefined,
  };

  try {
    const parsed = new URL(result.url);
    const authority = parsed.hostname;

    return {
      host: authority.replace(/^www\./, ""),
      path:
        parsed.pathname === "/" && !parsed.search && !parsed.hash
          ? ""
          : `${parsed.pathname}${parsed.search}${parsed.hash}`,
      protocol: parsed.protocol,
      faviconUrl: `/api/favicon?authority=${encodeURIComponent(authority)}&resolver=${encodeURIComponent(faviconResolver)}`,
    };
  } catch {
    return fallback;
  }
}

function getPlatformName(host: string) {
  switch (host) {
    case "youtube.com":
      return "YouTube";
    case "odysee.com":
      return "Odysee";
    case "dailymotion.com":
      return "Dailymotion";
    default:
      return host;
  }
}

function formatPublishedAt(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/u);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}.${month}.${year}`;
  }

  return normalized;
}

function formatResultUrl(
  result: SearchResult,
  meta: ReturnType<typeof getResultMeta>,
  mode: UrlFormattingMode,
) {
  switch (mode) {
    case "full":
      return result.url;
    case "host":
      return meta.host;
    default:
      return undefined;
  }
}

export const VideoResultCard = memo(function VideoResultCard({
  compactDensity = false,
  faviconResolver = "google",
  openInNewTab = true,
  result,
  showFavicons = true,
  showThumbnails = true,
  urlFormatting = "pretty",
}: VideoResultCardProps) {
  const t = useTranslations("Search");
  const meta = getResultMeta(result, faviconResolver);
  const formattedUrl = formatResultUrl(result, meta, urlFormatting);
  const engineNames = formatResultEngineNames(result);
  const videoMetaParts = [
    getPlatformName(meta.host),
    result.author,
    result.duration,
    result.publishedAt ? formatPublishedAt(result.publishedAt) : undefined,
  ].filter((part): part is string => Boolean(part?.trim()));

  return (
    <article className="max-w-4xl [contain-intrinsic-size:auto_280px] [content-visibility:auto]">
      <div className={cn("space-y-3", compactDensity && "space-y-2")}>
        <div className="flex items-start gap-3">
          {showFavicons ? (
            <SiteFavicon
              key={meta.faviconUrl}
              hostname={meta.host}
              src={meta.faviconUrl}
            />
          ) : null}

          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm leading-5 text-[var(--text-strong)]">
              {meta.host}
            </p>
            <p className="truncate text-sm leading-5 text-[var(--text-soft-alt)]">
              {formattedUrl ? (
                formattedUrl
              ) : (
                <>
                  {`${meta.protocol}//${meta.host}/`}
                  {meta.path ? (
                    <span className="text-[var(--text-soft)]">
                      {" › "} {meta.path}
                    </span>
                  ) : null}
                </>
              )}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col sm:flex-row sm:items-start",
            compactDensity ? "gap-3" : "gap-4",
          )}
        >
          <a
            href={result.url}
            target={openInNewTab ? "_blank" : undefined}
            rel={openInNewTab ? "noreferrer noopener" : undefined}
            className="block w-full shrink-0 sm:w-[220px]"
          >
            <div className="aspect-video overflow-hidden rounded-2xl bg-[var(--surface-panel)]">
              {!showThumbnails ? (
                <div className="flex h-full items-center justify-center text-sm text-[var(--text-soft-alt)]">
                  {t("previewHidden")}
                </div>
              ) : result.thumbnailUrl ? (
                // react-doctor-disable-next-line nextjs-no-img-element
                <img
                  src={result.thumbnailUrl}
                  alt={result.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--text-soft-alt)]">
                  {t("noThumbnail")}
                </div>
              )}
            </div>
          </a>

          <div className="min-w-0 space-y-0.5">
            <h2 className="line-clamp-2 text-[20px] leading-tight font-normal tracking-tight">
              <a
                href={result.url}
                target={openInNewTab ? "_blank" : undefined}
                rel={openInNewTab ? "noreferrer noopener" : undefined}
                className="text-primary transition-colors hover:underline"
              >
                {result.title}
              </a>
            </h2>

            {result.snippet ? (
              <p
                className={cn(
                  "line-clamp-2 text-[14px] text-[var(--text-body)]",
                  compactDensity ? "leading-5" : "leading-6",
                )}
              >
                {result.snippet}
              </p>
            ) : null}

            {videoMetaParts.length ? (
              <p className="text-[14px] leading-6 text-[var(--text-soft-alt)]">
                {videoMetaParts.join(" · ")}
              </p>
            ) : null}

            {engineNames ? (
              <p className="text-[13px] leading-5 text-[var(--text-engine)]">
                - {engineNames}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
});
