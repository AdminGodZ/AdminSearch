import assert from "node:assert/strict";
import test from "node:test";

import { extractAnswerTexts } from "../src/features/search/lib/answer-texts.ts";
import { calculateAnswer } from "../src/features/search/lib/calculator.ts";
import { looksLikeCalculatorExpression } from "../src/features/search/lib/calculator-query.ts";
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

test("calculator query gate accepts supported expression syntax", () => {
  for (const query of [
    "42",
    "1 + 2 * (3 ^ 4)",
    "1e3 + .5",
    "2pi",
    "e ^ 2",
    "5!",
    "gcd(48, 18) + lcm(4, 5)",
    "log10(100) + log1p(1)",
    "nthRoot(27, 3)",
    "round(sqrt(9), 2)",
  ]) {
    assert.equal(looksLikeCalculatorExpression(query), true, query);
  }
});

test("calculator query gate covers every configured function", () => {
  for (const query of [
    "abs(4)",
    "exp(1)",
    "factorial(5)",
    "gcd(48, 18)",
    "lcm(4, 5)",
    "log(8, 2)",
    "log1p(1)",
    "log2(8)",
    "log10(100)",
    "mod(7, 4)",
    "nthRoot(27, 3)",
    "pow(2, 8)",
    "round(1.234, 2)",
    "sign(2)",
    "sqrt(9)",
  ]) {
    assert.equal(looksLikeCalculatorExpression(query), true, query);
    assert.notEqual(calculateAnswer(query), undefined, query);
  }
});

test("calculator query gate rejects ordinary searches and unknown syntax", () => {
  for (const query of [
    "",
    "not a calculation",
    "nextjs performance",
    "iphone 16 pro",
    "version 2.0",
    "2fa setup",
    "https://example.com/1+1",
    "sin(1)",
    "x = 2",
    "sqrt 9",
    "(1 + 2",
    "1, 2",
    "1".repeat(257),
  ]) {
    assert.equal(looksLikeCalculatorExpression(query), false, query);
  }
});

test("math-like invalid expressions remain safe calculator misses", () => {
  assert.equal(looksLikeCalculatorExpression("1 ++"), true);
  assert.equal(calculateAnswer("1 ++"), undefined);
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
