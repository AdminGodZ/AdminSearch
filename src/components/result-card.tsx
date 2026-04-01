import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SearchResult } from "@/lib/search/types";

type ResultCardProps = {
  result: SearchResult;
};

export function ResultCard({ result }: ResultCardProps) {
  return (
    <Card className="rounded-[28px] border-[var(--surface-panel-border)] bg-[var(--surface-panel)] shadow-[var(--surface-shadow)]">
      <CardContent className="space-y-5 p-7 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
          {result.source ? <span>{result.source}</span> : null}
          {result.engine ? (
            <Badge
              variant="outline"
              className="rounded-full border-[var(--surface-chip-border)] bg-background/85 tracking-normal normal-case"
            >
              {result.engine}
            </Badge>
          ) : null}
        </div>

        <div className="text-[2rem] leading-tight font-semibold tracking-tight text-[var(--text-strong)] sm:text-[2.1rem]">
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
          <p className="text-[1.05rem] leading-8 text-[var(--text-body)]">
            {result.snippet}
          </p>
        ) : null}

        <p className="truncate text-sm text-[var(--text-soft-alt)]">
          {result.displayUrl ?? result.url}
        </p>
      </CardContent>
    </Card>
  );
}
