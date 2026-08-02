import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("video thumbnails stay direct links without inline player triggers", async () => {
  const videoResultCard = await readFile(
    new URL(
      "../src/features/search/components/video-result-card.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    videoResultCard,
    /<a\s+href=\{result\.url\}\s+target=\{openInNewTab \? "_blank" : undefined\}\s+rel=\{openInNewTab \? "noreferrer noopener" : undefined\}\s+className="block w-full shrink-0 sm:w-\[220px\]"\s*>/u,
  );
  assert.match(videoResultCard, /src=\{result\.thumbnailUrl\}/u);
  assert.match(videoResultCard, /loading="lazy"/u);
  assert.match(videoResultCard, /className="h-full w-full object-cover"/u);

  assert.doesNotMatch(videoResultCard, /<iframe\b/u);
  assert.doesNotMatch(
    videoResultCard,
    /onMouseEnter|onMouseLeave|onFocus|onBlur/u,
  );
  assert.doesNotMatch(
    videoResultCard,
    /showPreview|setShowPreview|buildVideoPreviewEmbedUrl|useMemo|useState/u,
  );
});
