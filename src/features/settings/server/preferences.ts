import { cookies } from "next/headers";
import { cache } from "react";

import {
  parsePreferencesCookie,
  SETTINGS_COOKIE_NAME,
} from "@/features/settings/lib/preferences";

async function readPersistedPreferences() {
  const cookieStore = await cookies();
  return parsePreferencesCookie(cookieStore.get(SETTINGS_COOKIE_NAME)?.value);
}

export const getPersistedPreferences = cache(readPersistedPreferences);
