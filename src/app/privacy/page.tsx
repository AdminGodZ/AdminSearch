import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <section className="border-b border-border/70 px-6 py-6 sm:px-8 lg:px-10">
        <div className="flex w-full items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex h-12 items-center text-[24px] leading-none font-semibold tracking-tight text-foreground select-none sm:h-14 sm:text-[26px]"
          >
            AdminSearch
          </Link>

          <Header className="w-auto" />
        </div>
      </section>

      <div className="flex-1 px-6 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Privacy
            </h1>
            <p className="text-sm leading-6 text-[var(--text-body)]">
              AdminSearch is a privacy-focused, self-hosted metasearch frontend
              powered by SearXNG.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Open source</h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              This project is open source. You can review the AdminSearch source
              code on{" "}
              <a
                href="https://github.com/AdminGodZ/AdminSearch"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70"
              >
                GitHub
              </a>
              . AdminSearch also builds on another open source project,{" "}
              <a
                href="https://github.com/searxng/searxng"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70"
              >
                SearXNG
              </a>
              , which provides the private metasearch backend.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Self-hosted privacy
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              Self-hosted AdminSearch instances are designed to be fully
              private. The browser talks to the AdminSearch frontend, and
              AdminSearch talks to the private SearXNG backend. The browser does
              not contact SearXNG directly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Search requests
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              AdminSearch does not need user accounts, tracking profiles, or
              client-side analytics to work. Like any metasearch service, the
              SearXNG backend may contact upstream search engines to retrieve
              results, but those requests are made by the private backend rather
              than directly by your browser.
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
