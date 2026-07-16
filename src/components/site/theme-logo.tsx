import Image from "next/image";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("ThemeLogo");

  return (
    <>
      <Image
        src="/logo_dark.png"
        alt={t("alt")}
        fill
        className={cn("dark:hidden", className)}
        sizes={sizes}
        priority={priority}
      />
      <Image
        src="/logo_white.png"
        alt={t("alt")}
        fill
        className={cn("hidden dark:block", className)}
        sizes={sizes}
        priority={priority}
      />
    </>
  );
}
