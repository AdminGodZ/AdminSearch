import { Card, CardContent } from "@/components/ui/card";
import type { SearchResult } from "@/features/search/types";

type ImageGridProps = {
  results: SearchResult[];
};

export function ImageGrid({ results }: ImageGridProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {results.map((result) => (
        <Card
          key={result.id}
          className="overflow-hidden rounded-[28px] border-[var(--surface-panel-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow)]"
        >
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer noopener"
            className="block"
          >
            <div className="aspect-[4/3] bg-muted">
              {result.thumbnailUrl ? (
                // biome-ignore lint/performance/noImgElement: Direct remote thumbnails are an explicit MVP tradeoff for image search.
                <img
                  src={result.thumbnailUrl}
                  alt={result.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No thumbnail
                </div>
              )}
            </div>
          </a>

          <CardContent className="space-y-2 p-5">
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer noopener"
              className="line-clamp-2 text-sm leading-6 font-medium text-[var(--text-strong)] transition-colors hover:text-primary"
            >
              {result.title}
            </a>
            <p className="truncate text-xs tracking-[0.18em] text-[var(--text-soft)] uppercase">
              {result.source ?? result.displayUrl ?? result.url}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
