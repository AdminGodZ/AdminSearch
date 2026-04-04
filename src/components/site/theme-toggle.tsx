"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <Button
      type="button"
      variant="chrome"
      size="header"
      onClick={toggleTheme}
      className="w-auto min-w-0 cursor-pointer justify-center whitespace-nowrap"
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
