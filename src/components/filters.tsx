"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import {
  Select,
  SelectContent,
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
      <SelectTrigger className="h-12 min-w-48 rounded-full px-4 text-[15px]">
        <SelectValue placeholder="Filter" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
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
    <div className="flex flex-col items-start gap-3 lg:items-end">
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
