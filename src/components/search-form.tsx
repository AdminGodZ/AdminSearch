import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchTab } from "@/lib/search/types";
import { cn } from "@/lib/utils";

type SearchFormProps = {
  action?: string;
  defaultQuery: string;
  tab?: SearchTab;
  language?: string;
  timeRange?: "day" | "month" | "year";
  safeSearch?: 0 | 1 | 2;
  size?: "hero" | "compact";
  variant?: "default" | "landing";
  placeholder?: string;
};

export function SearchForm({
  action = "/search",
  defaultQuery,
  tab,
  language,
  timeRange,
  safeSearch,
  size = "compact",
  variant = "default",
  placeholder = "Search the web or switch to images…",
}: SearchFormProps) {
  const isHero = size === "hero";
  const isLanding = variant === "landing";

  return (
    <form action={action} method="GET" className="w-full">
      {tab ? <input type="hidden" name="tab" value={tab} /> : null}
      {language ? (
        <input type="hidden" name="language" value={language} />
      ) : null}
      {timeRange ? (
        <input type="hidden" name="timeRange" value={timeRange} />
      ) : null}
      {safeSearch !== undefined ? (
        <input type="hidden" name="safeSearch" value={safeSearch} />
      ) : null}

      <div
        className={cn(
          "flex w-full flex-col gap-3 sm:flex-row",
          isHero && !isLanding ? "items-stretch" : "items-center",
        )}
      >
        <div className="relative flex-1">
          <label htmlFor="search-query" className="sr-only">
            Search query
          </label>
          <Search
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2",
              isLanding
                ? "left-7 z-10 size-6 text-foreground/55"
                : "left-5 size-4 text-[#b9b1a1]",
            )}
          />
          <Input
            id="search-query"
            name="q"
            type="search"
            defaultValue={defaultQuery}
            placeholder={placeholder}
            className={cn(
              "w-full backdrop-blur",
              isLanding
                ? "h-16 rounded-full border-[1.5px] border-foreground/35 bg-background pr-8 pl-18 text-base shadow-none sm:text-lg"
                : "border-[#e3d8c7] bg-[#faf5ea] pr-5 pl-12 text-[17px] shadow-[0_1px_2px_rgba(28,31,38,0.06),0_10px_20px_rgba(28,31,38,0.04)] placeholder:text-[#8f8a80]",
              isHero && !isLanding ? "h-16 rounded-full sm:text-lg" : "",
              !isHero && !isLanding ? "h-12 rounded-full" : "",
            )}
          />
        </div>

        {isLanding ? null : (
          <Button
            type="submit"
            size={isHero ? "lg" : "default"}
            className={cn(
              "rounded-full bg-[#2d4f79] px-7 text-white shadow-none hover:bg-[#244469]",
              isHero ? "h-16 text-base" : "h-12",
            )}
          >
            Search
          </Button>
        )}
      </div>
    </form>
  );
}
