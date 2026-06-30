"use client";

import { Moon, Sun } from "lucide-react";

import { useThemeTransition } from "@/components/providers/use-theme-transition";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useThemeTransition();

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <Button
      type="button"
      variant="chrome"
      size="header"
      onClick={toggleTheme}
      className={cn(
        "w-auto min-w-0 cursor-pointer justify-center whitespace-nowrap",
        className,
      )}
    >
      <span className="flex items-center justify-center dark:hidden">
        <Sun className="size-4" />
      </span>
      <span className="hidden items-center justify-center dark:flex">
        <Moon className="size-4" />
      </span>
      <span className="dark:hidden">Light</span>
      <span className="hidden dark:inline">Dark</span>
    </Button>
  );
}
