import { cookies } from "next/headers";

import {
  parsePreferencesCookie,
  SETTINGS_COOKIE_NAME,
} from "@/features/settings/lib/preferences";

export async function getPersistedPreferences() {
  const cookieStore = await cookies();
  return parsePreferencesCookie(cookieStore.get(SETTINGS_COOKIE_NAME)?.value);
}
