import type { Metadata } from "next";
import { getMessages } from "next-intl/server";

import { ScopedIntlClientProvider } from "@/components/providers/scoped-intl-client-provider";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { SpecialText } from "@/components/site/special-text";
import { ThemeLogo } from "@/components/site/theme-logo";
import { HomeSearchFormClient } from "@/features/search/components/home-search-form-client";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import {
  pickClientMessages,
  ROUTE_CLIENT_MESSAGE_NAMESPACES,
} from "@/i18n/client-messages";

export const metadata: Metadata = {
  title: {
    absolute: "AdminSearch",
  },
};

export default async function Home() {
  const [messages, preferences] = await Promise.all([
    getMessages(),
    getPersistedPreferences(),
  ]);

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="flex w-full justify-end pt-6 pl-6 pr-6 sm:pl-8 sm:pr-6 lg:pl-10 lg:pr-6">
        <Header className="w-auto" inverted />
      </div>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-6 sm:px-8 lg:px-10">
        <ScopedIntlClientProvider
          messages={pickClientMessages(
            messages,
            ROUTE_CLIENT_MESSAGE_NAMESPACES.home,
          )}
        >
          <section className="flex flex-1 flex-col items-center justify-start pt-18 pb-8">
            <div className="flex w-full max-w-4xl flex-col items-center">
              <div className="relative size-40 select-none sm:size-44">
                <ThemeLogo
                  className="object-contain translate-y-4 sm:translate-y-5"
                  initialTheme={preferences.settings.theme}
                  sizes="176px"
                  priority
                />
              </div>

              <h1 className="mt-4 select-none text-4xl leading-none font-semibold tracking-tight text-foreground dark:text-white sm:text-5xl">
                <SpecialText speed={22} delay={0.1} className="leading-none">
                  AdminSearch
                </SpecialText>
              </h1>

              <div className="mt-8 w-full max-w-3xl">
                <HomeSearchFormClient initialPreferences={preferences} />
              </div>
            </div>
          </section>
        </ScopedIntlClientProvider>
      </div>

      <Footer />
    </main>
  );
}
