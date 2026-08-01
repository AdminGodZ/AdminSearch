import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the home logo selects one optimized source for the active theme", async () => {
  const [themeLogo, homePage] = await Promise.all([
    readFile(
      new URL("../src/components/site/theme-logo.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(themeLogo, /getImageProps/u);
  assert.match(themeLogo, /<picture>/u);
  assert.match(themeLogo, /media="\(prefers-color-scheme: dark\)"/u);
  assert.match(themeLogo, /media="\(prefers-color-scheme: light\)"/u);
  assert.equal(themeLogo.match(/<img\b/gu)?.length, 1);
  assert.doesNotMatch(themeLogo, /dark:hidden|dark:block/u);
  assert.match(homePage, /initialTheme=\{preferences\.settings\.theme\}/u);
});
