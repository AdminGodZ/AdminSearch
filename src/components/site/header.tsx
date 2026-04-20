import { Settings } from "lucide-react";
import Link from "next/link";
import type { ComponentProps } from "react";

import { LanguageSelect } from "@/components/site/language-select";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HeaderProps = ComponentProps<"header">;

export function Header({
  className,
  ...props
}: HeaderProps & { inverted?: boolean }) {
  const { inverted = false, ...headerProps } = props;
  const invertedClassName = inverted
    ? "dark:text-white dark:[&_svg]:text-white"
    : undefined;

  return (
    <header
      className={cn("flex w-full items-center", className)}
      {...headerProps}
    >
      <div className="flex w-full items-center justify-end gap-2 sm:gap-3">
        <LanguageSelect className={invertedClassName} />
        <ThemeToggle className={invertedClassName} />
        <Button
          asChild
          variant="chrome"
          size="header"
          className={cn("w-10 min-w-0 cursor-pointer px-0", invertedClassName)}
        >
          <Link href="/settings" aria-label="Settings">
            <Settings className="size-4.5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
