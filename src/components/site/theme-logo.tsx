"use client";

import { getImageProps } from "next/image";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

import {
  type AppearanceMode,
  isAppearanceMode,
} from "@/features/settings/lib/themes";
import { cn } from "@/lib/utils";

type ThemeLogoProps = {
  className?: string;
  initialTheme: AppearanceMode;
  sizes: string;
  priority?: boolean;
};

export function ThemeLogo({
  className,
  initialTheme,
  sizes,
  priority = false,
}: ThemeLogoProps) {
  const t = useTranslations("ThemeLogo");
  const { theme } = useTheme();
  const activeTheme = theme && isAppearanceMode(theme) ? theme : initialTheme;
  const imageProps = {
    alt: t("alt"),
    className: cn("object-contain", className),
    fill: true,
    sizes,
    loading: priority ? ("eager" as const) : ("lazy" as const),
    fetchPriority: priority ? ("high" as const) : ("auto" as const),
  };
  const { props: lightLogoProps } = getImageProps({
    ...imageProps,
    src: "/logo_dark.png",
  });
  const { props: darkLogoProps } = getImageProps({
    ...imageProps,
    src: "/logo_white.png",
  });
  const displayedLogoProps =
    activeTheme === "dark" ? darkLogoProps : lightLogoProps;
  const { alt, ...displayedLogoRest } = displayedLogoProps;

  return (
    <>
      {priority && activeTheme === "system" ? (
        <>
          <link
            rel="preload"
            as="image"
            imageSrcSet={darkLogoProps.srcSet}
            imageSizes={darkLogoProps.sizes}
            media="(prefers-color-scheme: dark)"
          />
          <link
            rel="preload"
            as="image"
            imageSrcSet={lightLogoProps.srcSet}
            imageSizes={lightLogoProps.sizes}
            media="(prefers-color-scheme: light)"
          />
        </>
      ) : priority ? (
        <link
          rel="preload"
          as="image"
          imageSrcSet={displayedLogoProps.srcSet}
          imageSizes={displayedLogoProps.sizes}
        />
      ) : null}
      <picture>
        {activeTheme === "system" ? (
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={darkLogoProps.srcSet}
            sizes={darkLogoProps.sizes}
          />
        ) : null}
        {/* react-doctor-disable-next-line nextjs-no-img-element -- getImageProps supplies the optimized responsive source set. */}
        <img alt={alt} {...displayedLogoRest} />
      </picture>
    </>
  );
}
