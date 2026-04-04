"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="header"
      onClick={toggleTheme}
      className="w-auto min-w-0 cursor-pointer justify-center rounded-full border-transparent bg-[var(--header-control-bg)] whitespace-nowrap text-foreground shadow-none transition-colors hover:bg-[var(--header-control-hover)] focus-visible:border-transparent focus-visible:bg-[var(--header-control-active)] focus-visible:ring-0 active:translate-y-0"
    >
      <span className="flex items-center justify-center">
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </span>
      <span>{isDark ? "Light" : "Dark"}</span>
    </Button>
  );
}
