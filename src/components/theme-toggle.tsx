"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type ThemeMode = "light" | "dark";

function applyTheme(nextTheme: ThemeMode) {
  const root = document.documentElement;

  if (nextTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("adminsearch-theme");
    const preferredDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const nextTheme: ThemeMode =
      saved === "dark" || saved === "light"
        ? saved
        : preferredDark
          ? "dark"
          : "light";

    setTheme(nextTheme);
    applyTheme(nextTheme);
    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem("adminsearch-theme", nextTheme);
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggleTheme}
      className="h-11 rounded-full bg-background/80 px-3 shadow-none"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-muted">
        {mounted && theme === "dark" ? (
          <Sun className="size-4" />
        ) : (
          <Moon className="size-4" />
        )}
      </span>
      <span>{mounted && theme === "dark" ? "Light" : "Dark"}</span>
    </Button>
  );
}
