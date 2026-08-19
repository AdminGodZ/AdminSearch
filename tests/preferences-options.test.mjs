import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  autocompleteProviders,
  faviconResolvers,
} from "../src/features/settings/lib/provider-options.ts";

test("provider catalogs contain every requested autocomplete and favicon choice", async () => {
  assert.deepEqual(
    [...autocompleteProviders],
    [
      "bing",
      "brave",
      "duckduckgo",
      "google",
      "kagi",
      "qwant",
      "startpage",
      "wikipedia",
    ],
  );
  assert.deepEqual(
    [...faviconResolvers],
    ["google", "duckduckgo", "kagi", "yandex"],
  );

  const source = await readFile(
    new URL("../src/features/settings/lib/preferences.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /autocompleteProviders/u);
  assert.match(source, /faviconResolvers/u);
});

test("retired preference schemas migrate while Tor Check remains opt-in", async () => {
  const preferencesSource = await readFile(
    new URL("../src/features/settings/lib/preferences.ts", import.meta.url),
    "utf8",
  );

  assert.match(preferencesSource, /PREVIOUS_SETTINGS_COOKIE_VERSION = 3/u);
  assert.match(preferencesSource, /SETTINGS_COOKIE_VERSION = 4/u);
  assert.match(
    preferencesSource,
    /payload\.version === PREVIOUS_SETTINGS_COOKIE_VERSION/u,
  );
  assert.match(preferencesSource, /torCheck: false/u);
  assert.match(preferencesSource, /settings\.torCheck/u);
  assert.match(preferencesSource, /tor_check: "torCheck"/u);
});
