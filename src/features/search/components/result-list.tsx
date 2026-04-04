import { ImageGrid } from "@/features/search/components/image-grid";
import { ResultCard } from "@/features/search/components/result-card";
import { VideoResultCard } from "@/features/search/components/video-result-card";
import type { SearchResult, SearchTab } from "@/features/search/types";

type ResultListProps = {
  tab: SearchTab;
  results: SearchResult[];
};

export function ResultList({ tab, results }: ResultListProps) {
  if (tab === "images") {
    return <ImageGrid results={results} />;
  }

  if (tab === "videos") {
    return (
      <div className="space-y-8">
        {results.map((result) => (
          <VideoResultCard key={result.id} result={result} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {results.map((result) => (
        <ResultCard key={result.id} result={result} />
      ))}
    </div>
  );
}
