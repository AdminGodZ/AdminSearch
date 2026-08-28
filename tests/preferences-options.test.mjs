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

test("regular Google engines stay selectable while CSE remains the default", async () => {
  const [preferencesSource, searxngSettings] = await Promise.all([
    readFile(
      new URL("../src/features/settings/lib/preferences.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../searxng/core-config/settings.yml", import.meta.url),
      "utf8",
    ),
  ]);

  const unavailablePolicy = preferencesSource.slice(
    preferencesSource.indexOf("const UNAVAILABLE_ENGINE_REPLACEMENTS"),
    preferencesSource.indexOf("export function isEngineUnavailable"),
  );
  const defaultEngines = preferencesSource.slice(
    preferencesSource.indexOf("export const defaultEngineState"),
    preferencesSource.indexOf("export type PersistedPreferences"),
  );

  assert.doesNotMatch(unavailablePolicy, /google/u);
  assert.match(defaultEngines, /^\s+"google cse",$/mu);
  assert.match(defaultEngines, /^\s+"google cse images",$/mu);
  assert.doesNotMatch(defaultEngines, /^\s+"google",$/mu);
  assert.doesNotMatch(defaultEngines, /^\s+"google images",$/mu);
  assert.match(
    defaultEngines,
    /videos: new Set\(\["youtube", "google videos"\]\)/u,
  );
  assert.match(
    searxngSettings,
    /- name: google\n {4}disabled: false\n {2}- name: google cse\n {4}disabled: false/u,
  );
  assert.match(
    searxngSettings,
    /- name: google images\n {4}disabled: false\n {2}- name: google cse images\n {4}disabled: false/u,
  );
});
