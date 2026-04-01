"use client";

import { ImageIcon, Search as SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SearchTab } from "@/lib/search/types";
import { buildHref } from "@/lib/utils";

type SearchTabsProps = {
  tab: SearchTab;
};

const tabs = [
  { value: "all", label: "All", icon: SearchIcon },
  { value: "images", label: "Images", icon: ImageIcon },
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
      <TabsList className="h-auto rounded-full p-1">
        {tabs.map((item) => {
          const Icon = item.icon;

          return (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="rounded-full px-4 py-2 text-[15px]"
            >
              <Icon className="size-4" />
              {item.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
