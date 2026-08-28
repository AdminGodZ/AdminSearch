import assert from "node:assert/strict";
import test from "node:test";

import {
  extractProviderFailures,
  mergeProviderFailures,
} from "../src/features/search/lib/provider-failures.ts";

test("SearXNG provider failures are normalized without treating malformed data as outages", () => {
  assert.deepEqual(
    extractProviderFailures([
      ["duckduckgo", "CAPTCHA"],
      [" duckduckgo ", " CAPTCHA "],
      ["brave", "Too many requests"],
      ["startpage", "Suspended: access denied", 3_600],
      ["", "timeout"],
      ["google"],
      "wikidata",
      null,
    ]),
    [
      { engine: "duckduckgo", reason: "CAPTCHA" },
      { engine: "brave", reason: "Too many requests" },
      { engine: "startpage", reason: "Suspended: access denied" },
    ],
  );
  assert.deepEqual(extractProviderFailures(undefined), []);
  assert.deepEqual(extractProviderFailures({}), []);
});

test("provider failures survive pagination without duplicate warnings", () => {
  assert.deepEqual(
    mergeProviderFailures(
      [
        { engine: "DuckDuckGo", reason: "CAPTCHA" },
        { engine: "Brave", reason: "Too many requests" },
      ],
      [
        { engine: " duckduckgo ", reason: " captcha " },
        { engine: "Startpage", reason: "Suspended" },
      ],
    ),
    [
      { engine: "DuckDuckGo", reason: "CAPTCHA" },
      { engine: "Brave", reason: "Too many requests" },
      { engine: "Startpage", reason: "Suspended" },
    ],
  );
});
