import { Settings } from "lucide-react";
import type { ComponentProps } from "react";

import { LanguageSelect } from "@/components/site/language-select";
import { ThemeToggle } from "@/components/site/theme-toggle";
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
          variant="chrome"
          size="header"
          aria-label="Settings"
          className="w-10 min-w-0 cursor-pointer px-0"
        >
          <Settings className="size-4.5" />
        </Button>
      </div>
    </header>
  );
}
