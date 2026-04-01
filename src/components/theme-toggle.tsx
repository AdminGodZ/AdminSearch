"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

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
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "flex h-11 w-auto min-w-0 items-center justify-center gap-2 rounded-full border border-transparent bg-[var(--control-bg)] pl-4 pr-3 text-sm font-normal whitespace-nowrap text-foreground transition-colors outline-none hover:bg-[var(--control-hover)] focus-visible:border-transparent focus-visible:bg-[var(--control-active)] focus-visible:ring-0",
      )}
    >
      <span className="flex items-center justify-center">
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </span>
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
