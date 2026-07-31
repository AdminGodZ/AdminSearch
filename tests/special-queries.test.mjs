import assert from "node:assert/strict";
import test from "node:test";

import { extractAnswerTexts } from "../src/features/search/lib/answer-texts.ts";
import { calculateAnswer } from "../src/features/search/lib/calculator.ts";
import {
  getClientIp,
  getClientIpFromHeaders,
  getForwardableClientIp,
  getForwardableUserAgent,
  getForwardableUserAgentFromHeaders,
} from "../src/server/client-ip.ts";

test("calculator matches SearXNG's normalized answer format", () => {
  assert.equal(calculateAnswer("1+1"), "1 + 1 = 2");
  assert.equal(
    calculateAnswer("gcd(48, 18) + lcm(4, 5)"),
    "gcd(48, 18) + lcm(4, 5) = 26",
  );
  assert.equal(calculateAnswer("not a calculation"), undefined);
});

test("answer extraction supports legacy strings and typed SearXNG answers", () => {
  assert.deepEqual(
    extractAnswerTexts([
      "legacy answer",
      {
        template: "answer/legacy.html",
        answer: "100 cm",
        url: null,
      },
      { answer: "md5 hash digest: abc123" },
      { answer: " 100 cm " },
      { answer: "" },
      { translations: [] },
      null,
    ]),
    ["legacy answer", "100 cm", "md5 hash digest: abc123"],
  );
});

test("self-info forwards only valid, bounded request metadata", () => {
  assert.equal(getForwardableClientIp("203.0.113.10"), "203.0.113.10");
  assert.equal(getForwardableClientIp("2001:db8::10"), "2001:db8::10");
  assert.equal(getForwardableClientIp("anonymous"), undefined);
  assert.equal(getForwardableClientIp("not-an-ip"), undefined);

  const request = new Request("https://example.test", {
    headers: {
      "user-agent": "A".repeat(600),
      "x-forwarded-for": "203.0.113.10",
    },
  });

  assert.equal(getForwardableUserAgent(request)?.length, 512);
  assert.equal(
    getForwardableUserAgentFromHeaders(request.headers),
    getForwardableUserAgent(request),
  );
  assert.equal(getClientIpFromHeaders(request.headers), getClientIp(request));
});
