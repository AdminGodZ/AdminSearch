import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  GLOBAL_CLIENT_MESSAGE_NAMESPACES,
  pickClientMessages,
  ROUTE_CLIENT_MESSAGE_NAMESPACES,
} from "../src/i18n/client-messages.ts";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceRoot = resolve(projectRoot, "src");
const localImportPattern = /(?:from\s+|import\()\s*["'](@\/[^"']+)["']/gu;
const clientTranslationPattern = /useTranslations\(\s*["']([^"']+)["']\s*\)/gu;

async function resolveLocalImport(specifier) {
  const unresolvedPath = resolve(sourceRoot, specifier.slice(2));
  const candidates = extname(unresolvedPath)
    ? [unresolvedPath]
    : [
        `${unresolvedPath}.ts`,
        `${unresolvedPath}.tsx`,
        resolve(unresolvedPath, "index.ts"),
        resolve(unresolvedPath, "index.tsx"),
      ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported local module shape.
    }
  }

  return undefined;
}

async function collectClientTranslationNamespaces(entryPath) {
  const namespaces = new Set();
  const visited = new Set();

  async function visit(filePath) {
    if (visited.has(filePath)) {
      return;
    }

    visited.add(filePath);
    const source = await readFile(filePath, "utf8");

    for (const match of source.matchAll(clientTranslationPattern)) {
      namespaces.add(match[1]);
    }

    const importedPaths = [];
    for (const match of source.matchAll(localImportPattern)) {
      const importedPath = await resolveLocalImport(match[1]);

      if (importedPath) {
        importedPaths.push(importedPath);
      }
    }

    await Promise.all(importedPaths.map(visit));
  }

  await visit(resolve(projectRoot, entryPath));
  return [...namespaces].sort();
}

function combinedNamespaces(route) {
  return [
    ...GLOBAL_CLIENT_MESSAGE_NAMESPACES,
    ...ROUTE_CLIENT_MESSAGE_NAMESPACES[route],
  ].sort();
}

test("route scopes cover every client translation consumer", async () => {
  const [home, privacy, search, settings] = await Promise.all([
    collectClientTranslationNamespaces("src/app/page.tsx"),
    collectClientTranslationNamespaces("src/app/privacy/page.tsx"),
    collectClientTranslationNamespaces("src/app/search/page.tsx"),
    collectClientTranslationNamespaces("src/app/settings/page.tsx"),
  ]);

  assert.deepEqual(home, combinedNamespaces("home"));
  assert.deepEqual(privacy, [...GLOBAL_CLIENT_MESSAGE_NAMESPACES].sort());
  assert.deepEqual(search, combinedNamespaces("search"));
  assert.deepEqual(settings, combinedNamespaces("settings"));
});

test("client scopes stay disjoint and exclude server-only messages", () => {
  const globalNamespaces = new Set(GLOBAL_CLIENT_MESSAGE_NAMESPACES);
  const serverOnlyNamespaces = ["ApiErrors", "Privacy"];

  for (const routeNamespaces of Object.values(
    ROUTE_CLIENT_MESSAGE_NAMESPACES,
  )) {
    for (const namespace of routeNamespaces) {
      assert.equal(globalNamespaces.has(namespace), false);
    }
  }

  const allClientNamespaces = new Set([
    ...GLOBAL_CLIENT_MESSAGE_NAMESPACES,
    ...Object.values(ROUTE_CLIENT_MESSAGE_NAMESPACES).flat(),
  ]);

  for (const namespace of serverOnlyNamespaces) {
    assert.equal(allClientNamespaces.has(namespace), false);
  }
});

test("each locale provides exactly the selected namespaces", async () => {
  const localePaths = ["messages/en.json", "messages/de.json"];

  for (const localePath of localePaths) {
    const messages = JSON.parse(
      await readFile(resolve(projectRoot, localePath), "utf8"),
    );

    for (const route of Object.keys(ROUTE_CLIENT_MESSAGE_NAMESPACES)) {
      const namespaces = combinedNamespaces(route);
      const pickedMessages = pickClientMessages(messages, namespaces);

      assert.deepEqual(Object.keys(pickedMessages).sort(), namespaces);
      assert.equal("ApiErrors" in pickedMessages, false);
      assert.equal("Privacy" in pickedMessages, false);
    }
  }
});

test("each route mounts only its scoped provider", async () => {
  const routeSources = await Promise.all(
    ["page.tsx", "search/page.tsx", "settings/page.tsx"].map((routePath) =>
      readFile(resolve(sourceRoot, "app", routePath), "utf8"),
    ),
  );

  assert.match(routeSources[0], /ROUTE_CLIENT_MESSAGE_NAMESPACES\.home/u);
  assert.match(routeSources[1], /ROUTE_CLIENT_MESSAGE_NAMESPACES\.search/u);
  assert.match(routeSources[2], /ROUTE_CLIENT_MESSAGE_NAMESPACES\.settings/u);

  for (const source of routeSources) {
    assert.equal(source.match(/<ScopedIntlClientProvider\b/gu)?.length, 1);
  }
});
