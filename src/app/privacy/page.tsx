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
              AdminSearch is a self-hosted search frontend powered by SearXNG.
              This page is the place for your privacy policy and data-handling
              details once you publish them.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Current status
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              A full privacy policy has not been published yet. If you open
              source or publicly deploy this project, replace this placeholder
              with the actual retention, logging, analytics, and third-party
              service details for your instance.
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
