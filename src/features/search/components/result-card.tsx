import { SiteFavicon } from "@/features/search/components/site-favicon";
import type { SearchResult } from "@/features/search/types";
import { cn } from "@/lib/utils";

type ResultCardProps = {
  compactDensity?: boolean;
  faviconResolver?: string;
  openInNewTab?: boolean;
  result: SearchResult;
  showFavicons?: boolean;
};

function getResultMeta(result: SearchResult, faviconResolver: string) {
  const fallback = {
    host: result.source ?? result.displayUrl ?? result.url,
    path: "",
    faviconUrl: undefined as string | undefined,
  };

  try {
    const parsed = new URL(result.url);
    const authority = parsed.hostname;

    return {
      host: authority.replace(/^www\./, ""),
      path: parsed.pathname === "/" ? "" : parsed.pathname,
      faviconUrl: `/api/favicon?authority=${encodeURIComponent(authority)}&resolver=${encodeURIComponent(faviconResolver)}`,
    };
  } catch {
    return fallback;
  }
}

const platformNames = new Map<string, string>([
  ["about", "Google"],
  ["chatgpt", "ChatGPT"],
  ["github", "GitHub"],
  ["google", "Google"],
  ["reddit", "Reddit"],
  ["stackexchange", "Stack Exchange"],
  ["stackoverflow", "Stack Overflow"],
  ["wikipedia", "Wikipedia"],
  ["x", "X"],
  ["youtube", "YouTube"],
]);

function toTitleCase(value: string) {
  return value
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getPlatformLabel(host: string) {
  const segments = host.split(".").filter(Boolean);

  for (const segment of segments) {
    const normalized = segment.toLowerCase();
    const mapped = platformNames.get(normalized);

    if (mapped) {
      return mapped;
    }
  }

  const commonTlds = new Set([
    "com",
    "org",
    "net",
    "io",
    "co",
    "dev",
    "app",
    "ai",
    "gg",
    "tv",
  ]);

  const fallbackSegment =
    segments.length >= 2 && commonTlds.has(segments.at(-1) ?? "")
      ? segments.at(-2)
      : segments[0];

  return fallbackSegment ? toTitleCase(fallbackSegment) : host;
}

function formatEngineName(engine: string) {
  return engine.charAt(0).toUpperCase() + engine.slice(1);
}

function getPrimaryLabel(result: SearchResult, host: string) {
  const source = result.source?.trim();
  const platformLabel = getPlatformLabel(host);

  if (source && source !== host && source.length <= 40) {
    const normalizedSource = source.toLowerCase();
    const normalizedPlatform = platformLabel.toLowerCase();

    if (
      normalizedSource === normalizedPlatform ||
      normalizedSource.includes(normalizedPlatform) ||
      normalizedPlatform.includes(normalizedSource)
    ) {
      return platformLabel;
    }
  }

  return platformLabel;
}

export function ResultCard({
  compactDensity = false,
  faviconResolver = "google",
  openInNewTab = true,
  result,
  showFavicons = true,
}: ResultCardProps) {
  const meta = getResultMeta(result, faviconResolver);
  const primaryLabel = getPrimaryLabel(result, meta.host);

  return (
    <article className="max-w-4xl space-y-1">
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
            {primaryLabel}
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
            "text-[14px] text-[var(--text-body)]",
            compactDensity ? "leading-5" : "leading-6",
          )}
        >
          {result.snippet}
        </p>
      ) : null}

      {result.engine ? (
        <p className="text-[13px] leading-5 text-[var(--text-engine)]">
          - {formatEngineName(result.engine)}
        </p>
      ) : null}
    </article>
  );
}
