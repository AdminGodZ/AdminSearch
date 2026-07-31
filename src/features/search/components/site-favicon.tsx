"use client";

import { Globe } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

type SiteFaviconProps = {
  hostname: string;
  src?: string;
};

export function SiteFavicon({ hostname, src }: SiteFaviconProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-[var(--text-soft-alt)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
        <Globe className="size-4" />
      </span>
    );
  }

  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] dark:border-transparent dark:bg-white">
      <Image
        src={src}
        alt={`${hostname} favicon`}
        width={23}
        height={23}
        unoptimized
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="max-h-[23px] max-w-[23px] object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
