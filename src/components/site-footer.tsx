export function SiteFooter() {
  return (
    <footer className="bg-[var(--footer-bg)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-6 py-6 text-center">
        <p className="text-sm font-medium text-foreground/80">
          © 2026 AdminSearch
        </p>
        <p className="mt-1 text-xs text-foreground/55">
          Self-hosted metasearch powered by SearXNG.
        </p>
      </div>
    </footer>
  );
}
