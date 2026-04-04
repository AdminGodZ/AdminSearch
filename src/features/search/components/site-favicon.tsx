"use client";

import { Globe } from "lucide-react";
import { useState } from "react";

type SiteFaviconProps = {
  hostname: string;
  src?: string;
};

export function SiteFavicon({ hostname, src }: SiteFaviconProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-[var(--text-soft-alt)]">
        <Globe className="size-4" />
      </span>
    );
  }

  return (
    <span className="size-9 shrink-0 overflow-hidden rounded-full border border-border/70 bg-background">
      {/* biome-ignore lint/performance/noImgElement: Favicons are remote site assets with dynamic origins. */}
      <img
        src={src}
        alt={`${hostname} favicon`}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
