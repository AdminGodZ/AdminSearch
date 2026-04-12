"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[var(--footer-bg)]">
      <div className="grid w-full gap-5 px-6 py-4 text-center sm:px-8 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-10 lg:text-left">
        <div className="space-y-1 lg:justify-self-start">
          <p className="text-sm font-medium text-foreground dark:text-white">
            Country: Default
          </p>
        </div>

        <div className="space-y-1 lg:text-center">
          <p className="text-sm font-medium text-foreground dark:text-white">
            © 2026 AdminSearch
          </p>
          <p className="text-xs text-foreground/55 dark:text-white/70">
            Self-hosted metasearch powered by SearXNG.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 lg:justify-self-end">
          <a
            href="https://github.com/AdminGodZ/AdminSearch"
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm font-medium text-foreground transition-colors hover:text-foreground/70 dark:text-white dark:hover:text-white/70"
          >
            Source code
          </a>
          <span aria-hidden="true" className="text-sm text-white">
            ·
          </span>
          <Link
            href="/privacy"
            className="text-sm font-medium text-foreground transition-colors hover:text-foreground/70 dark:text-white dark:hover:text-white/70"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
