"use client";

import { ExternalLink, Globe, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef, useState } from "react";

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
  className,
  imageUrl,
  thumbnailUrl,
  title,
}: Pick<SearchResult, "imageUrl" | "thumbnailUrl" | "title"> & {
  className?: string;
}) {
  const t = useTranslations("Search");
  const [source, setSource] = useState(imageUrl ?? thumbnailUrl);

  if (!source) {
    return (
      <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        {t("noPreview")}
      </span>
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
      className={cn("h-full w-full bg-white object-contain", className)}
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

function getSourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatEngineName(engine: string) {
  return engine
    .split(/[._-]/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ImagePreviewDialog({
  onCloseAutoFocus,
  openInNewTab,
  result,
}: {
  onCloseAutoFocus: () => void;
  openInNewTab: boolean;
  result: SearchResult;
}) {
  const t = useTranslations("Search");
  const sourceHost = getSourceHost(result.url);
  const engineNames = [...new Set(result.engines ?? [result.engine])]
    .filter((engine): engine is string => Boolean(engine?.trim()))
    .map(formatEngineName)
    .join(", ");
  const metadataRows = [
    { label: t("imageSource"), value: result.imageSource },
    { label: t("imageAuthor"), value: result.author },
    { label: t("imageResolution"), value: result.resolution },
    {
      label: t("imageFormat"),
      value: result.imageFormat?.toUpperCase(),
    },
    { label: t("imageFileSize"), value: result.fileSize },
    { label: t("imagePublished"), value: result.publishedAt },
    { label: t("imageViews"), value: result.views },
    { label: t("imageEngine"), value: engineNames },
    { label: t("imageMetadata"), value: result.metadata },
  ].filter(
    (item): item is { label: string; value: string } =>
      Boolean(item.value?.trim()),
  );

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
      <DialogPrimitive.Content
        className="fixed top-1/2 left-1/2 z-50 flex h-[min(92dvh,900px)] w-[calc(100vw-1.5rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-white/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 sm:w-[calc(100vw-3rem)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogPrimitive.Close
          className="absolute top-3 right-3 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          aria-label={t("closeImagePreview")}
        >
          <X className="size-5" />
        </DialogPrimitive.Close>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-3 sm:p-6">
          <ImageResultPreview
            key={result.id}
            className="max-h-full max-w-full bg-transparent"
            imageUrl={result.imageUrl}
            thumbnailUrl={result.thumbnailUrl}
            title={result.title}
          />
        </div>

        <div className="max-h-[42dvh] shrink-0 overflow-y-auto border-t border-[var(--surface-panel-border)] bg-popover">
          <div className="space-y-4 p-4 sm:p-6">
            <div className="space-y-1.5 pr-10">
              <DialogPrimitive.Title className="text-base leading-6 font-semibold text-[var(--text-strong)] sm:text-lg">
                {result.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                className={cn(
                  "text-sm leading-6 text-[var(--text-body)]",
                  !result.snippet && "sr-only",
                )}
              >
                {result.snippet ?? t("imagePreviewDescription")}
              </DialogPrimitive.Description>
            </div>

            <div className="flex max-w-3xl flex-col items-start gap-3">
              <a
                href={result.url}
                target={openInNewTab ? "_blank" : undefined}
                rel={openInNewTab ? "noreferrer noopener" : undefined}
                className="group/source inline-flex max-w-full min-w-0 items-center gap-2.5 rounded-xl border border-[var(--surface-panel-border)] bg-[var(--surface-panel)] px-3 py-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Globe className="size-4 shrink-0 text-[var(--text-soft)]" />
                <span className="min-w-0 truncate text-sm font-medium text-[var(--text-strong)]">
                  {t("openImageSource")}
                </span>
                <span className="hidden min-w-0 max-w-56 truncate text-xs text-[var(--text-soft)] sm:inline">
                  {sourceHost}
                </span>
                <ExternalLink className="size-3.5 shrink-0 text-[var(--text-soft)] transition-colors group-hover/source:text-[var(--text-strong)]" />
              </a>

              {metadataRows.length > 0 ? (
                <dl className="grid w-full grid-cols-2 gap-x-5 gap-y-2.5 rounded-2xl bg-[var(--surface-panel)] px-3.5 py-3 sm:grid-cols-3">
                  {metadataRows.map((item) => (
                    <div key={item.label} className="min-w-0 space-y-0.5">
                      <dt className="text-[10px] leading-4 font-medium tracking-wide text-[var(--text-soft)] uppercase">
                        {item.label}
                      </dt>
                      <dd className="break-words text-sm leading-5 text-[var(--text-strong)]">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(
    null,
  );
  const openerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <DialogPrimitive.Root
      open={dialogOpen}
      onOpenChange={setDialogOpen}
    >
      <div
        className={cn(
          "grid min-w-0 grid-cols-2 items-start sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6",
          compactDensity ? "gap-1.5" : "gap-2",
        )}
      >
        {results.map((result) => (
          <button
            key={result.id}
            type="button"
            aria-label={t("openImagePreview", { title: result.title })}
            onClick={(event) => {
              openerRef.current = event.currentTarget;
              setSelectedResult(result);
              setDialogOpen(true);
            }}
            className="group flex min-w-0 cursor-pointer self-start flex-col overflow-hidden rounded-xl bg-[var(--surface-panel)] text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="aspect-[16/10] w-full overflow-hidden bg-muted">
              {!showThumbnails ? (
                <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  {t("previewHidden")}
                </span>
              ) : result.imageUrl || result.thumbnailUrl ? (
                <ImageResultPreview
                  imageUrl={result.imageUrl}
                  thumbnailUrl={result.thumbnailUrl}
                  title={result.title}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  {t("noPreview")}
                </span>
              )}
            </span>
            <span
              className={cn(
                "flex min-h-[68px] min-w-0 flex-1 flex-col justify-start space-y-0.5 px-2.5",
                compactDensity ? "py-1.5" : "py-2.5",
              )}
            >
              {showFavicons ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  <ImageFavicon
                    key={`${faviconResolver}:${result.url}`}
                    faviconResolver={faviconResolver}
                    url={result.url}
                  />
                </span>
              ) : null}
              <span className="line-clamp-2 text-xs leading-4 font-medium text-[var(--text-strong)] transition-colors group-hover:text-primary">
                {result.title}
              </span>
            </span>
          </button>
        ))}
      </div>

      {selectedResult ? (
        <ImagePreviewDialog
          onCloseAutoFocus={() => {
            openerRef.current?.focus();
            openerRef.current = null;
            setSelectedResult(null);
          }}
          openInNewTab={openInNewTab}
          result={selectedResult}
        />
      ) : null}
    </DialogPrimitive.Root>
  );
}
