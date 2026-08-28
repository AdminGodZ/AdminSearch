import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptPath = new URL(
  "../searxng/render-proxy-settings.py",
  import.meta.url,
);

function validateProxyEnvironment(overrides) {
  return spawnSync("python3", [scriptPath.pathname, "--validate-only"], {
    encoding: "utf8",
    env: {
      ...process.env,
      SEARXNG_OUTGOING_PROXY_URLS: "",
      SEARXNG_OUTGOING_RETRIES: "1",
      SEARXNG_OUTGOING_EXTRA_PROXY_TIMEOUT: "10",
      ...overrides,
    },
  });
}

test("the SearXNG proxy pool accepts supported URLs and removes duplicates", () => {
  const result = validateProxyEnvironment({
    SEARXNG_OUTGOING_PROXY_URLS: [
      "http://proxy-user:very-secret@proxy-a.example:8080",
      "socks5://proxy-b.example:1080",
      "http://proxy-user:very-secret@proxy-a.example:8080",
    ].join("\n"),
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Validated 2 outbound proxy entries\./u);
  assert.doesNotMatch(result.stdout, /very-secret|proxy-a\.example/u);
  assert.equal(result.stderr, "");
});

test("invalid proxy configuration fails closed without printing credentials", () => {
  const result = validateProxyEnvironment({
    SEARXNG_OUTGOING_PROXY_URLS:
      "ftp://proxy-user:very-secret@proxy-a.example:21",
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /uses an unsupported scheme/u);
  assert.doesNotMatch(result.stderr, /very-secret|proxy-a\.example/u);
});

test("proxy retry and timeout bounds are validated", () => {
  const invalidRetries = validateProxyEnvironment({
    SEARXNG_OUTGOING_RETRIES: "6",
  });
  const invalidTimeout = validateProxyEnvironment({
    SEARXNG_OUTGOING_EXTRA_PROXY_TIMEOUT: "61",
  });
  const fractionalTimeout = validateProxyEnvironment({
    SEARXNG_OUTGOING_EXTRA_PROXY_TIMEOUT: "10.5",
  });

  assert.equal(invalidRetries.status, 2);
  assert.match(invalidRetries.stderr, /between 0 and 5/u);
  assert.equal(invalidTimeout.status, 2);
  assert.match(invalidTimeout.stderr, /between 0 and 60 seconds/u);
  assert.equal(fractionalTimeout.status, 2);
  assert.match(fractionalTimeout.stderr, /must be an integer/u);
});
