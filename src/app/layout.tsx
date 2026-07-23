import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { ThemePreferencesSync } from "@/components/providers/theme-preferences-sync";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getPersistedPreferences } from "@/features/settings/server/preferences";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ),
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
  const [locale, preferences] = await Promise.all([
    getLocale(),
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
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme={preferences.settings.theme}
            enableSystem
          >
            <ThemePreferencesSync />
            <TooltipProvider>
              {children}
              <Toaster position="bottom-center" visibleToasts={3} />
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
