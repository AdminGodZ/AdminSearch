export const appearanceModes = ["light", "dark", "system"] as const;
export type AppearanceMode = (typeof appearanceModes)[number];

export const colorThemes = [
  {
    label: "GitHub",
    value: "github",
  },
  {
    label: "Codex",
    value: "codex",
  },
  {
    label: "Vercel",
    value: "vercel",
  },
] as const;

export type ColorTheme = (typeof colorThemes)[number]["value"];

export const DEFAULT_APPEARANCE_MODE: AppearanceMode = "light";
export const DEFAULT_COLOR_THEME: ColorTheme = "github";
export const COLOR_THEME_ATTRIBUTE = "data-color-theme";

export function isAppearanceMode(value: string): value is AppearanceMode {
  return appearanceModes.some((mode) => mode === value);
}

export function isColorTheme(value: string): value is ColorTheme {
  return colorThemes.some((theme) => theme.value === value);
}

export function applyColorTheme(theme: ColorTheme) {
  document.documentElement.setAttribute(COLOR_THEME_ATTRIBUTE, theme);
}
