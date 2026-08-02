import type { AbstractIntlMessages } from "next-intl";

export const GLOBAL_CLIENT_MESSAGE_NAMESPACES = [
  "Common",
  "Footer",
  "Header",
  "LanguageSelect",
  "SearxngVersion",
  "ThemeToggle",
] as const;

export const ROUTE_CLIENT_MESSAGE_NAMESPACES = {
  home: ["Home", "SearchForm", "SearchInput", "ThemeLogo"],
  search: [
    "Filters",
    "Metadata",
    "Search",
    "SearchForm",
    "SearchInput",
    "SearchTabs",
  ],
  settings: ["Settings"],
} as const;

type GlobalClientMessageNamespace =
  (typeof GLOBAL_CLIENT_MESSAGE_NAMESPACES)[number];
type RouteClientMessageNamespace =
  (typeof ROUTE_CLIENT_MESSAGE_NAMESPACES)[keyof typeof ROUTE_CLIENT_MESSAGE_NAMESPACES][number];

export type ClientMessageNamespace =
  | GlobalClientMessageNamespace
  | RouteClientMessageNamespace;

export function pickClientMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly ClientMessageNamespace[],
) {
  const pickedMessages: AbstractIntlMessages = {};

  for (const namespace of namespaces) {
    const namespaceMessages = messages[namespace];

    if (namespaceMessages === undefined) {
      throw new Error(`Missing client message namespace: ${namespace}`);
    }

    pickedMessages[namespace] = namespaceMessages;
  }

  return pickedMessages;
}
