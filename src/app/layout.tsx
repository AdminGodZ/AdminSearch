import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { ThemePreferencesSync } from "@/components/providers/theme-preferences-sync";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import {
  GLOBAL_CLIENT_MESSAGE_NAMESPACES,
  pickClientMessages,
} from "@/i18n/client-messages";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const DEFAULT_METADATA_BASE = "http://localhost:3000";

function getMetadataBase() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_METADATA_BASE;

  if (!URL.canParse(configuredUrl)) {
    return new URL(DEFAULT_METADATA_BASE);
  }

  const metadataBase = new URL(configuredUrl);

  return metadataBase.protocol === "http:" || metadataBase.protocol === "https:"
    ? metadataBase
    : new URL(DEFAULT_METADATA_BASE);
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    metadataBase: getMetadataBase(),
    title: {
      default: "AdminSearch",
      template: "AdminSearch - %s",
    },
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages, preferences] = await Promise.all([
    getLocale(),
    getMessages(),
    getPersistedPreferences(),
  ]);

  return (
    <html
      lang={locale}
      data-color-theme={preferences.settings.colorTheme}
      suppressHydrationWarning
      className={`min-h-full font-sans ${geist.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider
          messages={pickClientMessages(
            messages,
            GLOBAL_CLIENT_MESSAGE_NAMESPACES,
          )}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme={preferences.settings.theme}
            enableSystem
          >
            <ThemePreferencesSync />
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
