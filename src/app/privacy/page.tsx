import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return { title: t("privacyTitle") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");

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
              {t("title")}
            </h1>
            <p className="text-sm leading-6 text-[var(--text-body)]">
              {t("intro")}
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              {t("searchRequestsTitle")}
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              {t("searchRequestsBody")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              {t("browserStorageTitle")}
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              {t("browserStorageBody")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              {t("rateLimitingTitle")}
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              {t("rateLimitingBody")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              {t("externalContentTitle")}
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              {t("externalContentBody")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              {t("hostingTitle")}
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              {t("hostingBody")}
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              {t("sourceTitle")}
            </h2>
            <p className="text-sm leading-7 text-[var(--text-body)]">
              {t.rich("sourceBody", {
                link: (chunks) => (
                  <a
                    href="https://github.com/AdminGodZ/AdminSearch"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </section>

          <p className="text-xs leading-5 text-[var(--text-soft)]">
            {t("lastUpdated")}
          </p>
        </div>
      </div>

      <Footer />
    </main>
  );
}
