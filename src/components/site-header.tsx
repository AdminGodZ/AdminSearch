import { LanguageSelect } from "@/components/language-select";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="flex w-full items-center">
      <div className="flex w-full items-center justify-end gap-2 sm:gap-3">
        <LanguageSelect />
        <ThemeToggle />
      </div>
    </header>
  );
}
