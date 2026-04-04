import Image from "next/image";

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
    <Image
      src="/AdminGod_white_transparent.png"
      alt="AdminSearch logo"
      fill
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}
