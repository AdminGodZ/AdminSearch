import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the Sonner toaster is scoped to the settings route", async () => {
  const [rootLayout, settingsPage] = await Promise.all([
    readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/settings/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(rootLayout, /components\/ui\/sonner/u);
  assert.match(settingsPage, /components\/ui\/sonner/u);
  assert.match(
    settingsPage,
    /<Toaster position="bottom-center" visibleToasts=\{3\} \/>/u,
  );
});
