export function Footer() {
  return (
    <footer className="bg-[var(--footer-bg)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-6 py-4 text-center">
        <p className="text-sm font-medium text-foreground dark:text-white">
          © 2026 AdminSearch
        </p>
        <p className="mt-1 text-xs text-foreground/55 dark:text-white/70">
          Self-hosted metasearch powered by SearXNG.
        </p>
      </div>
    </footer>
  );
}
