"use client";

import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { buildHref, cn } from "@/lib/utils";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<FilterGroupKey>("language");

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

  const activeConfig =
    groups.find((group) => group.key === activeGroup) ?? groups[0];

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="-mb-px relative h-10 cursor-pointer border-0 border-b-2 border-b-transparent px-0 pr-6 pb-3 text-[15px] font-medium text-[var(--text-soft-alt)] transition-colors hover:text-foreground"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setActiveGroup("language");
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="relative top-[1px]">More</span>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-[58%]" />
      </button>

      {isOpen ? (
        <div className="absolute top-full left-0 z-40 mt-2 flex">
          <div className="w-[220px] rounded-2xl border border-[#ebebeb] bg-popover p-1 shadow-[0_14px_40px_rgba(16,18,24,0.12)] dark:border-border">
            {groups.map((group) => (
              <button
                key={group.key}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-[1rem] px-4 py-3 text-left text-[15px] transition-colors",
                  activeGroup === group.key
                    ? "bg-[#f4f4f5] text-foreground dark:bg-[#27272a]"
                    : "text-[var(--text-body)] hover:bg-[#f4f4f5] dark:hover:bg-[#27272a]",
                )}
                onMouseEnter={() => setActiveGroup(group.key)}
                onFocus={() => setActiveGroup(group.key)}
                onClick={() => setActiveGroup(group.key)}
              >
                <div className="min-w-0">
                  <p>{group.label}</p>
                  <p className="truncate text-sm text-[var(--text-soft-alt)]">
                    {getOptionLabel(group.options, group.value)}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-[var(--text-soft-alt)]" />
              </button>
            ))}
          </div>

          <div className="ml-2 w-[220px] rounded-2xl border border-[#ebebeb] bg-popover p-1 shadow-[0_14px_40px_rgba(16,18,24,0.12)] dark:border-border">
            {activeConfig.options.map((option) => {
              const selected = option.value === activeConfig.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-[1rem] px-4 py-3 text-left text-[15px] transition-colors",
                    selected
                      ? "bg-[#f4f4f5] text-foreground dark:bg-[#27272a]"
                      : "text-[var(--text-body)] hover:bg-[#f4f4f5] dark:hover:bg-[#27272a]",
                  )}
                  onClick={() => applyOption(activeConfig.key, option.value)}
                >
                  <span>{option.label}</span>
                  {selected ? <Check className="size-4" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
