import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("persisted preferences use one shared module-level request cache", async () => {
  const source = await readFile(
    new URL("../src/features/settings/server/preferences.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /import \{ cache \} from "react";/u);
  assert.match(source, /async function readPersistedPreferences\(\)/u);
  assert.match(
    source,
    /export const getPersistedPreferences = cache\(readPersistedPreferences\);/u,
  );
  assert.equal(source.match(/cache\(readPersistedPreferences\)/gu)?.length, 1);
});

test("React server cache deduplicates one render and isolates later requests", async () => {
  const probePath = new URL(
    "./fixtures/request-cache-probe.mjs",
    import.meta.url,
  );
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ["--conditions=react-server", probePath.pathname],
    { encoding: "utf8" },
  );

  assert.equal(stderr, "");
  assert.deepEqual(JSON.parse(stdout), {
    observations: [
      { requestNumber: 1, sameReference: true },
      { requestNumber: 2, sameReference: true },
    ],
    readCount: 2,
    readsAfterFirstRequest: 1,
  });
});
