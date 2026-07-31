"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/features/search/components/search-input";
import type { SearchTab } from "@/features/search/types";
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
  placeholder,
  inputClassName,
}: SearchFormProps) {
  const t = useTranslations("SearchForm");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isHero = size === "hero";
  const isLanding = variant === "landing";
  const resolvedPlaceholder = placeholder ?? t("defaultPlaceholder");
  const hiddenFields = (
    <>
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
    </>
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const destination = new URL(form.action, window.location.href);

    if (destination.origin !== window.location.origin) {
      return;
    }

    const params = new URLSearchParams();

    for (const [name, value] of new FormData(form)) {
      if (typeof value === "string") {
        params.append(name, value);
      }
    }

    destination.search = params.toString();
    const href = `${destination.pathname}${destination.search}${destination.hash}`;
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    event.preventDefault();

    startTransition(() => {
      if (href === currentHref) {
        router.refresh();
        return;
      }

      router.push(href);
    });
  }

  if (isLanding) {
    return (
      <form
        action={action}
        method="GET"
        className="w-full"
        onSubmit={handleSubmit}
        aria-busy={isPending}
        data-search-navigation-pending={isPending ? "" : undefined}
      >
        {hiddenFields}
        <SearchInput
          key={defaultQuery}
          defaultValue={defaultQuery}
          placeholder={resolvedPlaceholder}
          size={size}
          className={inputClassName}
          pending={isPending}
        />
      </form>
    );
  }

  return (
    <form
      action={action}
      method="GET"
      className="w-full"
      onSubmit={handleSubmit}
      aria-busy={isPending}
      data-search-navigation-pending={isPending ? "" : undefined}
    >
      {hiddenFields}

      <div
        className={cn(
          "flex w-full flex-col gap-3 sm:flex-row",
          isHero ? "items-stretch" : "items-center",
        )}
      >
        <div className="flex-1">
          <SearchInput
            key={defaultQuery}
            defaultValue={defaultQuery}
            placeholder={resolvedPlaceholder}
            size={size}
            className={inputClassName}
            pending={isPending}
          />
        </div>

        <Button
          type="submit"
          size={isHero ? "lg" : "default"}
          variant="brand"
          className={cn(
            "rounded-full px-7 shadow-none",
            isHero ? "h-16 text-base" : "h-12",
          )}
        >
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
