import { LandingSearchInput } from "@/components/landing-search-input";
import { Button } from "@/components/ui/button";
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
  inputClassName?: string;
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
  inputClassName,
}: SearchFormProps) {
  const isHero = size === "hero";
  const isLanding = variant === "landing";

  if (isLanding) {
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

        <LandingSearchInput
          defaultValue={defaultQuery}
          placeholder={placeholder}
          className={inputClassName}
        />
      </form>
    );
  }

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
          isHero ? "items-stretch" : "items-center",
        )}
      >
        <div className="flex-1">
          <LandingSearchInput
            defaultValue={defaultQuery}
            placeholder={placeholder}
            className={cn(!isHero ? "h-12 text-[17px]" : "")}
          />
        </div>

        <Button
          type="submit"
          size={isHero ? "lg" : "default"}
          className={cn(
            "rounded-full px-7 shadow-none",
            isHero
              ? "h-16 text-base"
              : "h-12 bg-[var(--brand-button)] text-white hover:bg-[var(--brand-button-hover)] dark:text-[var(--primary-foreground)]",
          )}
        >
          Search
        </Button>
      </div>
    </form>
  );
}
