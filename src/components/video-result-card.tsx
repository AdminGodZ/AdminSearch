"use client";

import { useMemo, useState } from "react";
import { SiteFavicon } from "@/components/site-favicon";
import type { SearchResult } from "@/lib/search/types";

type VideoResultCardProps = {
  result: SearchResult;
};

function getResultMeta(result: SearchResult) {
  const fallback = {
    host: result.source ?? result.displayUrl ?? result.url,
    path: "",
    faviconUrl: undefined as string | undefined,
  };

  try {
    const parsed = new URL(result.url);
    return {
      host: parsed.hostname.replace(/^www\./, ""),
      path: parsed.pathname === "/" ? "" : parsed.pathname,
      faviconUrl: `${parsed.origin}/favicon.ico`,
    };
  } catch {
    return fallback;
  }
}

function formatEngineName(engine: string) {
  return engine.charAt(0).toUpperCase() + engine.slice(1);
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

function buildPreviewSrc(previewUrl: string) {
  try {
    const url = new URL(previewUrl);

    if (url.hostname.includes("youtube")) {
      url.searchParams.set("autoplay", "1");
      url.searchParams.set("mute", "1");
      url.searchParams.set("controls", "0");
      url.searchParams.set("playsinline", "1");
      url.searchParams.set("rel", "0");
      url.searchParams.set("iv_load_policy", "3");
      url.searchParams.set("fs", "0");
      url.searchParams.set("disablekb", "1");
      return url.toString();
    }

    url.searchParams.set("autoplay", "1");
    url.searchParams.set("mute", "1");
    return url.toString();
  } catch {
    return previewUrl;
  }
}

export function VideoResultCard({ result }: VideoResultCardProps) {
  const meta = getResultMeta(result);
  const [showPreview, setShowPreview] = useState(false);
  const previewSrc = useMemo(
    () => (result.previewUrl ? buildPreviewSrc(result.previewUrl) : undefined),
    [result.previewUrl],
  );
  const videoMetaParts = [
    getPlatformName(meta.host),
    result.author,
    result.duration,
    result.publishedAt ? formatPublishedAt(result.publishedAt) : undefined,
  ].filter((part): part is string => Boolean(part?.trim()));

  return (
    <article className="max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <a
          href={result.url}
          target="_blank"
          rel="noreferrer noopener"
          className="block w-full shrink-0 sm:w-[220px]"
          onMouseEnter={() => setShowPreview(true)}
          onMouseLeave={() => setShowPreview(false)}
          onFocus={() => setShowPreview(true)}
          onBlur={() => setShowPreview(false)}
        >
          <div className="aspect-video overflow-hidden rounded-2xl bg-[var(--surface-panel)]">
            {showPreview && previewSrc ? (
              <iframe
                src={previewSrc}
                title={`${result.title} preview`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            ) : result.thumbnailUrl ? (
              // biome-ignore lint/performance/noImgElement: Direct remote thumbnails are already used for image search and video previews.
              <img
                src={result.thumbnailUrl}
                alt={result.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-soft-alt)]">
                No thumbnail
              </div>
            )}
          </div>
        </a>

        <div className="min-w-0 space-y-1">
          <div className="flex items-start gap-3">
            <SiteFavicon hostname={meta.host} src={meta.faviconUrl} />

            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm leading-5 text-[var(--text-strong)]">
                {meta.host}
              </p>
              <p className="truncate text-sm leading-5 text-[var(--text-soft-alt)]">
                {`https://${meta.host}/`}
                {meta.path ? (
                  <span className="text-[var(--text-soft)]">
                    {" › "} {meta.path}
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <h2 className="text-[20px] leading-tight font-normal tracking-tight">
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary transition-colors hover:underline"
            >
              {result.title}
            </a>
          </h2>

          {result.snippet ? (
            <p className="line-clamp-3 text-[14px] leading-6 text-[var(--text-body)]">
              {result.snippet}
            </p>
          ) : null}

          {videoMetaParts.length ? (
            <p className="text-[14px] leading-6 text-[var(--text-soft-alt)]">
              {videoMetaParts.join(" · ")}
            </p>
          ) : null}

          {result.engine ? (
            <p className="text-[13px] leading-5 text-[var(--text-soft-alt)]">
              - {formatEngineName(result.engine)}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
