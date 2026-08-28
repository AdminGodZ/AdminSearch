import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatResultEngineNames,
  getResultEngines,
  mergeResultEngines,
  rankResultsByEngineConsensus,
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

test("result engine metadata merges contributors case-insensitively", () => {
  assert.deepEqual(
    mergeResultEngines(
      { engine: "google", engines: ["Brave"] },
      { engine: "duckduckgo", engines: ["GOOGLE", "startpage"] },
    ),
    ["Brave", "google", "startpage", "duckduckgo"],
  );
});

test("results rank by distinct contributing engines and keep relevance ties stable", () => {
  const results = [
    { id: "one", engines: ["google"] },
    { id: "three", engines: ["brave", "google", "duckduckgo"] },
    { id: "two-a", engine: "google", engines: ["brave", "GOOGLE"] },
    { id: "two-b", engines: ["startpage", "bing"] },
    { id: "one-b", engine: "wikipedia" },
  ];

  assert.deepEqual(
    rankResultsByEngineConsensus(results).map((result) => result.id),
    ["three", "two-a", "two-b", "one", "one-b"],
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

test("initial and paginated responses both apply engine-consensus ranking", async () => {
  const [transformSource, responseSource] = await Promise.all([
    readFile(
      new URL("../src/features/search/server/transform.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/features/search/lib/response.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(transformSource, /rankResultsByEngineConsensus\(/u);
  assert.match(
    responseSource,
    /rankResultsByEngineConsensus\(mergedResults\)/u,
  );
});
