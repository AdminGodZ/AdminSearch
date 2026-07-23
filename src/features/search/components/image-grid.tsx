"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { SearchResult } from "@/features/search/types";
import { cn } from "@/lib/utils";

type ImageGridProps = {
  compactDensity?: boolean;
  faviconResolver?: string;
  openInNewTab?: boolean;
  results: SearchResult[];
  showFavicons?: boolean;
  showThumbnails?: boolean;
};

function ImageResultPreview({
  imageUrl,
  thumbnailUrl,
  title,
}: Pick<SearchResult, "imageUrl" | "thumbnailUrl" | "title">) {
  const t = useTranslations("Search");
  const [source, setSource] = useState(imageUrl ?? thumbnailUrl);

  if (!source) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        {t("noPreview")}
      </div>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: Image search uses SearXNG's original remote image URL and falls back to its thumbnail.
    <img
      src={source}
      alt={title}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="h-full w-full bg-white object-contain"
      onError={() => {
        if (thumbnailUrl && source !== thumbnailUrl) {
          setSource(thumbnailUrl);
          return;
        }

        setSource(undefined);
      }}
    />
  );
}

function ImageFavicon({
  faviconResolver,
  url,
}: {
  faviconResolver: string;
  url: string;
}) {
  const [failed, setFailed] = useState(false);

  let authority: string;
  let faviconUrl: string | undefined;

  try {
    const parsed = new URL(url);
    authority = parsed.hostname.replace(/^www\./, "");
    faviconUrl = `/api/favicon?authority=${encodeURIComponent(parsed.hostname)}&resolver=${encodeURIComponent(faviconResolver)}`;
  } catch {
    authority = url;
    faviconUrl = undefined;
  }

  if (!faviconUrl || failed) {
    return (
      <>
        <Globe className="size-3 shrink-0 text-[var(--text-soft)]" />
        <span className="truncate text-[11px] leading-none text-[var(--text-soft)]">
          {authority}
        </span>
      </>
    );
  }

  return (
    <>
      {/* biome-ignore lint/performance/noImgElement: Favicons are remote site assets with dynamic origins. */}
      <img
        src={faviconUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="size-3 shrink-0 rounded-[2px] object-contain"
        onError={() => setFailed(true)}
      />
      <span className="truncate text-[11px] leading-none text-[var(--text-soft)]">
        {authority}
      </span>
    </>
  );
}

export function ImageGrid({
  compactDensity = false,
  faviconResolver = "google",
  openInNewTab = true,
  results,
  showFavicons = true,
  showThumbnails = true,
}: ImageGridProps) {
  const t = useTranslations("Search");

  return (
    <div
      className={cn(
        "grid min-w-0 items-start grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6",
        compactDensity ? "gap-1.5" : "gap-2",
      )}
    >
      {results.map((result) => (
        <a
          key={result.id}
          href={result.url}
          target={openInNewTab ? "_blank" : undefined}
          rel={openInNewTab ? "noreferrer noopener" : undefined}
          className="group flex min-w-0 self-start flex-col overflow-hidden rounded-xl bg-[var(--surface-panel)]"
        >
          <div className="aspect-[16/10] overflow-hidden bg-muted">
            {!showThumbnails ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                {t("previewHidden")}
              </div>
            ) : result.imageUrl || result.thumbnailUrl ? (
              <ImageResultPreview
                imageUrl={result.imageUrl}
                thumbnailUrl={result.thumbnailUrl}
                title={result.title}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                {t("noPreview")}
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex min-h-[68px] min-w-0 flex-1 flex-col justify-start space-y-0.5 px-2.5",
              compactDensity ? "py-1.5" : "py-2.5",
            )}
          >
            {showFavicons ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <ImageFavicon
                  key={`${faviconResolver}:${result.url}`}
                  faviconResolver={faviconResolver}
                  url={result.url}
                />
              </div>
            ) : null}
            <p className="line-clamp-2 text-xs leading-4 font-medium text-[var(--text-strong)] transition-colors group-hover:text-primary">
              {result.title}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}
