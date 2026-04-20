import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
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

      <section className="flex-1" />

      <Footer />
    </main>
  );
}
