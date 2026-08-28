import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatResultEngineNames,
  getResultEngines,
} from "../src/features/search/lib/result-engines.ts";

test("result engine metadata keeps every unique contributing engine", () => {
  assert.deepEqual(
    getResultEngines({
      engine: "google",
      engines: ["brave", "Google", " duckduckgo ", "brave", ""],
    }),
    ["brave", "Google", "duckduckgo"],
  );
  assert.deepEqual(getResultEngines({ engine: "startpage" }), ["startpage"]);
  assert.deepEqual(getResultEngines({}), []);
});

test("result engine metadata formats the full contributing engine list", () => {
  assert.equal(
    formatResultEngineNames({
      engine: "youtube",
      engines: ["google cse", "brave.videos", "duckduckgo", "GOOGLE CSE"],
    }),
    "Google CSE, Brave Videos, DuckDuckGo, YouTube",
  );
});

test("every result renderer uses the shared multi-engine label", async () => {
  const componentSources = await Promise.all(
    ["result-card.tsx", "video-result-card.tsx", "image-grid.tsx"].map(
      (component) =>
        readFile(
          new URL(
            `../src/features/search/components/${component}`,
            import.meta.url,
          ),
          "utf8",
        ),
    ),
  );

  for (const source of componentSources) {
    assert.match(source, /formatResultEngineNames\(result\)/u);
    assert.doesNotMatch(source, /formatEngineName\(result\.engine\)/u);
  }
});
