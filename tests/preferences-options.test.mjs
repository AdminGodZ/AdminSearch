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

test("AI overview and Tor Check are persisted, opt-in preferences", async () => {
  const source = await readFile(
    new URL("../src/features/settings/lib/preferences.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /aiOverview: false/u);
  assert.match(source, /torCheck: false/u);
  assert.match(source, /settings\.aiOverview/u);
  assert.match(source, /settings\.torCheck/u);
  assert.match(source, /tor_check: "torCheck"/u);
});
