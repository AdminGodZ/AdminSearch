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
              AdminSearch is designed to minimize data collection while
              providing search through a private SearXNG backend.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Search requests
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              Search and autocomplete terms are sent to the AdminSearch server
              and then to its private SearXNG service. SearXNG contacts the
              selected external search providers and returns their results.
              AdminSearch does not require an account and does not include
              client-side analytics or advertising trackers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Browser storage
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              Preferences are stored in a first-party cookie for up to one year,
              or for the current session if persistent storage is disabled.
              Language and storage choices use local or session storage. If
              result reuse is enabled, recent search results can be kept in
              session storage for up to 30 minutes. The cookie is sent only to
              AdminSearch; local and session storage stay on your device. All of
              this data can be removed through your browser&apos;s site data
              controls.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Rate limiting
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              The server may use your IP address as part of a temporary
              Redis/Valkey rate-limit key. The key expires after the configured
              rate-limit window, which is one minute by default. AdminSearch
              does not maintain a separate account database or server-side
              search history.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              External content
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              Favicons are fetched by the AdminSearch server from Google or
              DuckDuckGo. Result thumbnails are loaded from their source, and
              optional video previews can connect your browser to providers such
              as YouTube, Vimeo, Dailymotion, or Odysee. Favicons and thumbnails
              can be disabled in settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Hosting</h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              The maintained deployment is hosted on Railway in Amsterdam.
              Railway processes the network and technical request data needed to
              operate the service, and infrastructure logs may include request
              metadata. Self-hosted AdminSearch instances may use different
              providers, logging, and retention settings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Source and questions
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              AdminSearch is open source. You can review the code or contact the
              maintainer through the{" "}
              <a
                href="https://github.com/AdminGodZ/AdminSearch"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70"
              >
                GitHub repository
              </a>
              .
            </p>
          </section>

          <p className="text-xs leading-5 text-[var(--text-soft)]">
            Last updated: June 30, 2026
          </p>
        </div>
      </div>

      <Footer />
    </main>
  );
}
