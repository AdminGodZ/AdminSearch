import { ImageGrid } from "@/features/search/components/image-grid";
import { ResultCard } from "@/features/search/components/result-card";
import { VideoResultCard } from "@/features/search/components/video-result-card";
import type { SearchResult, SearchTab } from "@/features/search/types";
import type { UrlFormattingMode } from "@/features/settings/lib/preferences";

type ResultListProps = {
  compactDensity?: boolean;
  faviconResolver?: string;
  openInNewTab?: boolean;
  tab: SearchTab;
  results: SearchResult[];
  showFavicons?: boolean;
  showThumbnails?: boolean;
  urlFormatting?: UrlFormattingMode;
};

export function ResultList({
  compactDensity = false,
  faviconResolver = "google",
  openInNewTab = true,
  tab,
  results,
  showFavicons = true,
  showThumbnails = true,
  urlFormatting = "pretty",
}: ResultListProps) {
  if (tab === "images") {
    return (
      <ImageGrid
        compactDensity={compactDensity}
        faviconResolver={faviconResolver}
        openInNewTab={openInNewTab}
        results={results}
        showFavicons={showFavicons}
        showThumbnails={showThumbnails}
      />
    );
  }

  if (tab === "videos") {
    return (
      <div className={compactDensity ? "space-y-5" : "space-y-8"}>
        {results.map((result) => (
          <VideoResultCard
            key={result.id}
            compactDensity={compactDensity}
            faviconResolver={faviconResolver}
            openInNewTab={openInNewTab}
            result={result}
            showFavicons={showFavicons}
            showThumbnails={showThumbnails}
            urlFormatting={urlFormatting}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={compactDensity ? "space-y-5" : "space-y-8"}>
      {results.map((result) => (
        <ResultCard
          key={result.id}
          compactDensity={compactDensity}
          faviconResolver={faviconResolver}
          openInNewTab={openInNewTab}
          result={result}
          showFavicons={showFavicons}
          urlFormatting={urlFormatting}
        />
      ))}
    </div>
  );
}
