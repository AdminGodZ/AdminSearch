"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildHref } from "@/lib/utils";

type FiltersProps = {
  language?: string;
  timeRange?: "day" | "month" | "year";
  safeSearch: 0 | 1 | 2;
};

const languages = [
  { value: "auto", label: "Language: Auto" },
  { value: "en", label: "Language: English" },
  { value: "de", label: "Language: German" },
  { value: "fr", label: "Language: French" },
  { value: "es", label: "Language: Spanish" },
  { value: "it", label: "Language: Italian" },
];

const timeRanges = [
  { value: "any", label: "Any time" },
  { value: "day", label: "Past day" },
  { value: "month", label: "Past month" },
  { value: "year", label: "Past year" },
];

const safeSearchOptions = [
  { value: "0", label: "Safe search: Off" },
  { value: "1", label: "Safe search: Moderate" },
  { value: "2", label: "Safe search: Strict" },
];

function SelectChip({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 min-w-0 rounded-none border-transparent bg-transparent px-0 pb-3 text-[15px] text-[var(--text-soft-alt)] shadow-none hover:bg-transparent hover:text-foreground focus-visible:border-transparent focus-visible:bg-transparent focus-visible:text-foreground focus-visible:ring-0 data-[state=open]:bg-transparent data-[state=open]:text-foreground">
        <SelectValue placeholder="Filter" />
      </SelectTrigger>
      <SelectContent position="popper" align="end" className="p-1">
        <SelectGroup className="p-0">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="focus:bg-[var(--control-active)] focus:text-foreground"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function Filters({ language, timeRange, safeSearch }: FiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function replaceParams(updates: Record<string, string | null>) {
    startTransition(() => {
      router.replace(buildHref(pathname, searchParams, updates), {
        scroll: false,
      });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <SelectChip
        value={language ?? "auto"}
        onChange={(value) =>
          replaceParams({
            language: value === "auto" ? null : value,
            page: null,
          })
        }
        options={languages}
      />
      <SelectChip
        value={timeRange ?? "any"}
        onChange={(value) =>
          replaceParams({
            timeRange: value === "any" ? null : value,
            page: null,
          })
        }
        options={timeRanges}
      />
      <SelectChip
        value={String(safeSearch)}
        onChange={(value) =>
          replaceParams({
            safeSearch: value,
            page: null,
          })
        }
        options={safeSearchOptions}
      />
    </div>
  );
}
