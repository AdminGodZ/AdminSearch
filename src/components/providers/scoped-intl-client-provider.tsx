"use client";

import {
  type AbstractIntlMessages,
  NextIntlClientProvider,
  useLocale,
  useMessages,
} from "next-intl";
import { type ReactNode, useMemo } from "react";

export function ScopedIntlClientProvider({
  children,
  messages,
}: {
  children: ReactNode;
  messages: AbstractIntlMessages;
}) {
  const locale = useLocale();
  const inheritedMessages = useMessages();
  const mergedMessages = useMemo(
    () => ({ ...inheritedMessages, ...messages }),
    [inheritedMessages, messages],
  );

  return (
    <NextIntlClientProvider locale={locale} messages={mergedMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
