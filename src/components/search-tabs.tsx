"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SearchTab } from "@/lib/search/types";
import { buildHref } from "@/lib/utils";

type SearchTabsProps = {
  tab: SearchTab;
};

const tabs = [
  { value: "all", label: "All" },
  { value: "images", label: "Images" },
  { value: "videos", label: "Videos" },
  { value: "news", label: "News" },
] as const;

export function SearchTabs({ tab }: SearchTabsProps) {
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
            className="-mb-px h-10 cursor-pointer flex-none rounded-none border-0 border-b-2 border-b-transparent px-0 pb-3 text-[15px] font-medium text-[var(--text-soft-alt)] shadow-none outline-none ring-0 transition-colors hover:text-foreground focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-b-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none after:hidden"
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
