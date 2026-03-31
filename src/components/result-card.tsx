import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SearchResult } from "@/lib/search/types";

type ResultCardProps = {
  result: SearchResult;
};

export function ResultCard({ result }: ResultCardProps) {
  return (
    <Card className="rounded-[28px] border-[#e5ddcf] bg-[#fdfaf4] shadow-[0_1px_2px_rgba(28,31,38,0.05),0_18px_40px_rgba(28,31,38,0.05)]">
      <CardContent className="space-y-5 p-7 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
          {result.source ? <span>{result.source}</span> : null}
          {result.engine ? (
            <Badge
              variant="outline"
              className="rounded-full border-[#ddd2bf] bg-background/85 tracking-normal normal-case"
            >
              {result.engine}
            </Badge>
          ) : null}
        </div>

        <div className="text-[2rem] leading-tight font-semibold tracking-tight text-[#222a38] sm:text-[2.1rem]">
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-start gap-2 transition-colors hover:text-primary"
          >
            <span>{result.title}</span>
            <ExternalLink className="mt-1.5 size-4 shrink-0" />
          </a>
        </div>
        {result.snippet ? (
          <p className="text-[1.05rem] leading-8 text-[#5d6474]">
            {result.snippet}
          </p>
        ) : null}

        <p className="truncate text-sm text-[#6a7080]">
          {result.displayUrl ?? result.url}
        </p>
      </CardContent>
    </Card>
  );
}
