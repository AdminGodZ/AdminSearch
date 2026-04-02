import { ImageGrid } from "@/components/image-grid";
import { ResultCard } from "@/components/result-card";
import type { SearchResult, SearchTab } from "@/lib/search/types";

type ResultListProps = {
  tab: SearchTab;
  results: SearchResult[];
};

export function ResultList({ tab, results }: ResultListProps) {
  if (tab === "images") {
    return <ImageGrid results={results} />;
  }

  return (
    <div className="space-y-8">
      {results.map((result) => (
        <ResultCard key={result.id} result={result} />
      ))}
    </div>
  );
}
