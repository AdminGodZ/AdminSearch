import type { Metadata } from "next";
import Link from "next/link";
import { getMessages, getTranslations } from "next-intl/server";

import { ScopedIntlClientProvider } from "@/components/providers/scoped-intl-client-provider";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Toaster } from "@/components/ui/sonner";
import { SettingsPagePreview } from "@/features/settings/components/settings-page-preview";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import {
  pickClientMessages,
  ROUTE_CLIENT_MESSAGE_NAMESPACES,
} from "@/i18n/client-messages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return { title: t("settingsTitle") };
}

export default async function SettingsPage() {
  const [messages, preferences] = await Promise.all([
    getMessages(),
    getPersistedPreferences(),
  ]);

  return (
    <>
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

        <ScopedIntlClientProvider
          messages={pickClientMessages(
            messages,
            ROUTE_CLIENT_MESSAGE_NAMESPACES.settings,
          )}
        >
          <SettingsPagePreview
            initialSettings={preferences.settings}
            initialEngines={preferences.engines}
          />
        </ScopedIntlClientProvider>

        <Footer />
      </main>
      <Toaster position="bottom-center" visibleToasts={3} />
    </>
  );
}
