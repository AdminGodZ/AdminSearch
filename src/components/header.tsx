import { Settings } from "lucide-react";
import type { ComponentProps } from "react";

import { LanguageSelect } from "@/components/language-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeaderProps = ComponentProps<"header">;

export function Header({ className, ...props }: HeaderProps) {
  return (
    <header className={cn("flex w-full items-center", className)} {...props}>
      <div className="flex w-full items-center justify-end gap-2 sm:gap-3">
        <LanguageSelect />
        <ThemeToggle />
        <Button
          type="button"
          variant="outline"
          size="header"
          aria-label="Settings"
          className="w-10 min-w-0 cursor-pointer rounded-full border-transparent bg-[var(--header-control-bg)] px-0 text-foreground shadow-none transition-colors hover:bg-[var(--header-control-hover)] focus-visible:border-transparent focus-visible:bg-[var(--header-control-active)] focus-visible:ring-0 active:translate-y-0"
        >
          <Settings className="size-4.5" />
        </Button>
      </div>
    </header>
  );
}
