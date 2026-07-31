import assert from "node:assert/strict";
import test from "node:test";

import imageModule from "next/image.js";

const { getImageProps } = imageModule;

test("unoptimized favicon images preserve query-bearing API URLs", () => {
  const src = "/api/favicon?authority=example.com&resolver=google";
  const { props } = getImageProps({
    src,
    alt: "example.com favicon",
    width: 23,
    height: 23,
    unoptimized: true,
  });

  assert.equal(props.src, src);
  assert.equal(props.srcSet, undefined);
});
