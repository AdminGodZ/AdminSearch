"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { searchTabTriggerClassName } from "@/features/search/components/search-tabs";
import { buildHref } from "@/features/search/lib/url-state";
import { cn } from "@/lib/utils";

type FiltersProps = {
  language?: string;
  timeRange?: "day" | "month" | "year";
  safeSearch: 0 | 1 | 2;
};

type FilterGroupKey = "language" | "timeRange" | "safeSearch";

type FilterOption = {
  value: string;
  label: string;
};

const languages: FilterOption[] = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "it", label: "Italian" },
];

const timeRanges: FilterOption[] = [
  { value: "any", label: "Any time" },
  { value: "day", label: "Past day" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
];

const safeSearchOptions: FilterOption[] = [
  { value: "0", label: "Off" },
  { value: "1", label: "Moderate" },
  { value: "2", label: "Strict" },
];

function getOptionLabel(options: FilterOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function Filters({ language, timeRange, safeSearch }: FiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const groups = useMemo(
    () =>
      [
        {
          key: "language" as const,
          label: "Language",
          value: language ?? "auto",
          options: languages,
        },
        {
          key: "timeRange" as const,
          label: "Time",
          value: timeRange ?? "any",
          options: timeRanges,
        },
        {
          key: "safeSearch" as const,
          label: "Safe search",
          value: String(safeSearch),
          options: safeSearchOptions,
        },
      ] satisfies Array<{
        key: FilterGroupKey;
        label: string;
        value: string;
        options: FilterOption[];
      }>,
    [language, safeSearch, timeRange],
  );

  function replaceParams(updates: Record<string, string | null>) {
    startTransition(() => {
      router.replace(buildHref(pathname, searchParams, updates), {
        scroll: false,
      });
      setIsOpen(false);
    });
  }

  function applyOption(group: FilterGroupKey, value: string) {
    if (group === "language") {
      replaceParams({
        language: value === "auto" ? null : value,
        page: null,
      });
      return;
    }

    if (group === "timeRange") {
      replaceParams({
        timeRange: value === "any" ? null : value,
        page: null,
      });
      return;
    }

    replaceParams({
      safeSearch: value,
      page: null,
    });
  }

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            searchTabTriggerClassName,
            "inline-flex items-center justify-center gap-1.5 leading-none data-[state=open]:border-b-transparent data-[state=open]:text-foreground",
          )}
          aria-label="More filters"
        >
          <span>More</span>
          <ChevronDown className="pointer-events-none size-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="min-w-[220px] rounded-2xl p-1"
      >
        {groups.map((group) => (
          <DropdownMenuSub key={group.key}>
            <DropdownMenuSubTrigger className="rounded-xl py-2.5 pr-3 pl-3 focus:bg-[#f4f4f5] dark:focus:bg-[#27272a] data-[state=open]:bg-[#f4f4f5] dark:data-[state=open]:bg-[#27272a]">
              <div className="min-w-0">
                <p className="text-sm leading-5">{group.label}</p>
                <p className="truncate text-sm text-[var(--text-soft-alt)]">
                  {getOptionLabel(group.options, group.value)}
                </p>
              </div>
            </DropdownMenuSubTrigger>

            <DropdownMenuSubContent
              sideOffset={12}
              className="min-w-[220px] rounded-2xl p-1"
            >
              <DropdownMenuRadioGroup value={group.value}>
                {group.options.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    className={cn(
                      "rounded-xl py-2.5 pr-8 pl-3 focus:bg-[#f4f4f5] dark:focus:bg-[#27272a]",
                      option.value === group.value
                        ? "text-foreground"
                        : "text-[var(--text-body)]",
                    )}
                    onSelect={() => applyOption(group.key, option.value)}
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
