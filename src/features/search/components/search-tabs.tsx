"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { startTransition } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildHref } from "@/features/search/lib/url-state";
import type { SearchTab } from "@/features/search/types";

type SearchTabsProps = {
  tab: SearchTab;
  trailingContent?: ReactNode;
};

export const searchTabTriggerClassName =
  "relative inline-flex h-10 cursor-pointer flex-none items-center justify-center gap-1.5 rounded-none border-0 border-b-2 border-b-transparent px-0 pt-1 pb-3 text-[15px] font-medium leading-none whitespace-nowrap text-[var(--text-soft-alt)] shadow-none outline-none ring-0 transition-colors hover:text-foreground focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-b-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 after:hidden";

const tabs = [
  { value: "all", label: "All" },
  { value: "images", label: "Images" },
  { value: "videos", label: "Videos" },
  { value: "news", label: "News" },
] as const;

export function SearchTabs({ tab, trailingContent }: SearchTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function setTab(nextTab: SearchTab) {
    startTransition(() => {
      router.replace(
        buildHref(pathname, searchParams, { tab: nextTab, page: null }),
        {
          scroll: false,
        },
      );
    });
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as SearchTab)}
      className="w-full lg:w-auto"
    >
      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-8 rounded-none bg-transparent p-0"
      >
        {tabs.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className={searchTabTriggerClassName}
          >
            {item.label}
          </TabsTrigger>
        ))}
        {trailingContent}
      </TabsList>
    </Tabs>
  );
}
