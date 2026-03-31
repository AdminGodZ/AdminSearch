import { Grid3X3 } from "lucide-react";
import Image from "next/image";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="flex w-full items-center">
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="ghost"
          className="h-11 rounded-full px-3 text-sm font-normal"
        >
          English
        </Button>
        <ThemeToggle />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-full"
        >
          <Grid3X3 className="size-5" />
        </Button>
        <div className="relative size-11 overflow-hidden rounded-full bg-linear-to-br from-violet-400 to-pink-400 shadow-sm">
          <Image
            src="/AdminGod_white.png"
            alt="AdminGod profile"
            fill
            className="object-contain p-1.5"
            sizes="44px"
          />
        </div>
      </div>
    </header>
  );
}
