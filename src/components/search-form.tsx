import { Search } from "lucide-react";
import { LandingSearchInput } from "@/components/landing-search-input";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
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
          <label htmlFor="search-query" className="sr-only">
            Search query
          </label>
          <InputGroup
            className={cn(
              "w-full",
              isHero ? "h-[50px] rounded-full" : "",
              !isHero ? "h-12 rounded-full" : "",
            )}
          >
            <InputGroupAddon align="inline-start" className="pl-4">
              <InputGroupText>
                <Search className="size-4" />
              </InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="search-query"
              name="q"
              type="search"
              defaultValue={defaultQuery}
              placeholder={placeholder}
              className="w-full pr-5 text-[17px]"
            />
          </InputGroup>
        </div>

        <Button
          type="submit"
          size={isHero ? "lg" : "default"}
          className={cn(
            "rounded-full px-7 shadow-none",
            isHero ? "h-16 text-base" : "h-12",
          )}
        >
          Search
        </Button>
      </div>
    </form>
  );
}
