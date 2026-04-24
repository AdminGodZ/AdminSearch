import Image from "next/image";

import { cn } from "@/lib/utils";

type ThemeLogoProps = {
  className?: string;
  sizes: string;
  priority?: boolean;
};

export function ThemeLogo({
  className,
  sizes,
  priority = false,
}: ThemeLogoProps) {
  return (
    <>
      <Image
        src="/logo_dark.png"
        alt="AdminSearch logo"
        fill
        className={cn("dark:hidden", className)}
        sizes={sizes}
        priority={priority}
      />
      <Image
        src="/logo_white.png"
        alt="AdminSearch logo"
        fill
        className={cn("hidden dark:block", className)}
        sizes={sizes}
        priority={priority}
      />
    </>
  );
}
