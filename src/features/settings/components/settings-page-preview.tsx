"use client";

import {
  Globe,
  Image as ImageIcon,
  Info,
  Monitor,
  Newspaper,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useThemeTransition } from "@/components/providers/use-theme-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  defaultEngineState,
  defaultSettingsState,
  type EngineGroupKey,
  type EngineState,
  engineCatalog,
  normalizeHttpMethod,
  normalizeResultReuseMode,
  normalizeUrlFormattingMode,
  type SettingsState,
} from "@/features/settings/lib/preferences";
import {
  appearanceModes,
  applyColorTheme,
  colorThemes,
  isAppearanceMode,
  isColorTheme,
} from "@/features/settings/lib/themes";
import {
  broadcastSettingsSync,
  persistPreferencesCookie as persistCookie,
  persistSettingsStorageMode,
  persistUiLanguagePreference,
  readPersistedPreferencesFromBrowser,
  readUiLanguagePreference,
} from "@/features/settings/lib/preferences-client";
import { cn } from "@/lib/utils";

type SectionId = "general" | "interface" | "privacy" | "engines" | "special";

const navSectionDefinitions: Array<{
  id: SectionId;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "general",
    icon: Globe,
  },
  {
    id: "interface",
    icon: Palette,
  },
  {
    id: "privacy",
    icon: ShieldCheck,
  },
  {
    id: "engines",
    icon: Monitor,
  },
  {
    id: "special",
    icon: Sparkles,
  },
];

const engineGroupIcons: Record<
  EngineGroupKey,
  React.ComponentType<{ className?: string }>
> = {
  general: Search,
  images: ImageIcon,
  videos: Video,
  news: Newspaper,
};

const engineGroupOrder: EngineGroupKey[] = [
  "general",
  "images",
  "videos",
  "news",
];

const selectTriggerClass =
  "h-10 w-full min-w-[200px] rounded-xl border-[var(--surface-panel-border)] bg-background px-3.5 text-[14px] font-medium shadow-none hover:border-foreground/20 focus-visible:border-foreground/30 focus-visible:ring-foreground/5 data-[state=open]:border-foreground/30";
const settingsToastId = "settings-unsaved-changes";
const settingsToastWidth = "min(calc(100vw - 2rem), 660px)";

type SettingRowProps = {
  label: string;
  description: string;
  children: React.ReactNode;
};

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0 sm:max-w-[520px]">
        <p className="text-[14.5px] font-medium text-[var(--text-strong)]">
          {label}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-soft)]">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center sm:justify-end">
        {children}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked
          ? "bg-foreground"
          : "bg-[var(--surface-chip-border)] hover:bg-[var(--surface-chip-border)]/80",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

function SettingSelect({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={selectTriggerClass}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="center"
        className="min-w-[220px] p-1"
      >
        <SelectGroup className="p-0">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

type EngineRowsProps = {
  groupKey: EngineGroupKey;
  filter: string;
  selected: Set<string>;
  onToggle: (engine: string) => void;
};

function EngineRows({ groupKey, filter, selected, onToggle }: EngineRowsProps) {
  const t = useTranslations("Settings");
  const allEngines = engineCatalog[groupKey];
  const filtered = filter
    ? allEngines.filter((engine) =>
        engine.toLowerCase().includes(filter.toLowerCase()),
      )
    : allEngines;

  return (
    <div className="divide-y divide-[var(--surface-panel-border)]">
      {filtered.length === 0 ? (
        <p className="py-5 text-[13px] text-[var(--text-soft)]">
          {t("noEngines")}
        </p>
      ) : (
        filtered.map((engine) => (
          <div
            key={engine}
            className="flex min-h-14 items-center justify-between gap-4 py-3"
          >
            <span className="min-w-0 truncate text-[14.5px] font-medium text-[var(--text-strong)]">
              {engine}
            </span>
            <Toggle
              checked={selected.has(engine)}
              onToggle={() => onToggle(engine)}
              label={t(
                selected.has(engine) ? "disableEngine" : "enableEngine",
                { engine },
              )}
            />
          </div>
        ))
      )}
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-2">
      <h2 className="text-[22px] font-semibold tracking-tight text-[var(--text-strong)]">
        {title}
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-soft)]">
        {description}
      </p>
    </div>
  );
}

function cloneEngineState(source: EngineState): EngineState {
  return {
    general: new Set(source.general),
    images: new Set(source.images),
    videos: new Set(source.videos),
    news: new Set(source.news),
  };
}

type SettingsPagePreviewProps = {
  initialEngines: EngineState;
  initialSettings: SettingsState;
};

export function SettingsPagePreview({
  initialEngines,
  initialSettings,
}: SettingsPagePreviewProps) {
  const t = useTranslations("Settings");
  const common = useTranslations("Common");
  const router = useRouter();
  const { setTheme, theme: activeAppearanceMode } = useThemeTransition();
  const saveHandlerRef = useRef<() => void>(() => undefined);
  const discardHandlerRef = useRef<() => void>(() => undefined);
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [savedSettings, setSavedSettings] =
    useState<SettingsState>(initialSettings);
  const [engines, setEngines] = useState<EngineState>(() =>
    cloneEngineState(initialEngines),
  );
  const [savedEngines, setSavedEngines] = useState<EngineState>(() =>
    cloneEngineState(initialEngines),
  );
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const [engineFilter, setEngineFilter] = useState("");
  const [activeEngineGroup, setActiveEngineGroup] =
    useState<EngineGroupKey>("general");
  const navSections = navSectionDefinitions.map((section) => ({
    ...section,
    label: t(`nav.${section.id}.label`),
    description: t(`nav.${section.id}.description`),
  }));
  const engineGroupMeta = Object.fromEntries(
    engineGroupOrder.map((key) => [
      key,
      {
        title: t(`engineGroups.${key}.title`),
        description: t(`engineGroups.${key}.description`),
        icon: engineGroupIcons[key],
      },
    ]),
  ) as Record<
    EngineGroupKey,
    {
      title: string;
      description: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  >;

  useEffect(() => {
    setSettings((current) =>
      current.uiLanguage === initialSettings.uiLanguage
        ? current
        : { ...current, uiLanguage: initialSettings.uiLanguage },
    );
    setSavedSettings((current) =>
      current.uiLanguage === initialSettings.uiLanguage
        ? current
        : { ...current, uiLanguage: initialSettings.uiLanguage },
    );
  }, [initialSettings.uiLanguage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    readPersistedPreferencesFromBrowser();

    const uiLanguage = readUiLanguagePreference();

    if (uiLanguage === "en" || uiLanguage === "de") {
      setSettings((current) =>
        current.uiLanguage === uiLanguage
          ? current
          : { ...current, uiLanguage },
      );
      setSavedSettings((current) =>
        current.uiLanguage === uiLanguage
          ? current
          : { ...current, uiLanguage },
      );
    }
  }, []);

  useEffect(() => {
    if (
      !activeAppearanceMode ||
      !isAppearanceMode(activeAppearanceMode)
    ) {
      return;
    }

    setSettings((current) =>
      current.theme === activeAppearanceMode
        ? current
        : { ...current, theme: activeAppearanceMode },
    );
    setSavedSettings((current) =>
      current.theme === activeAppearanceMode
        ? current
        : { ...current, theme: activeAppearanceMode },
    );
  }, [activeAppearanceMode]);

  const isDirty = useMemo(() => {
    const settingsChanged = (
      Object.keys(defaultSettingsState) as Array<keyof SettingsState>
    ).some((key) => settings[key] !== savedSettings[key]);
    const enginesChanged = (
      Object.keys(defaultEngineState) as EngineGroupKey[]
    ).some((key) => {
      const next = engines[key];
      const base = savedEngines[key];
      if (next.size !== base.size) return true;
      for (const value of next) {
        if (!base.has(value)) return true;
      }
      return false;
    });
    return settingsChanged || enginesChanged;
  }, [engines, savedEngines, savedSettings, settings]);

  function updateSetting<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function toggleEngine(group: EngineGroupKey, engine: string) {
    setEngines((current) => {
      const next = new Set(current[group]);
      if (next.has(engine)) {
        next.delete(engine);
      } else {
        next.add(engine);
      }
      return { ...current, [group]: next };
    });
  }

  function discardChanges() {
    setSettings(savedSettings);
    setEngines(cloneEngineState(savedEngines));
  }

  function handleSave() {
    if (typeof window === "undefined") {
      return;
    }

    const nextSettings = { ...settings };
    const nextEngines = cloneEngineState(engines);
    const languageChanged =
      nextSettings.uiLanguage !== savedSettings.uiLanguage;

    persistCookie(
      {
        settings: nextSettings,
        engines: nextEngines,
      },
      {
        persistent: nextSettings.storeDefaultsLocally,
      },
    );

    persistSettingsStorageMode(nextSettings.storeDefaultsLocally);

    persistUiLanguagePreference(
      nextSettings.uiLanguage,
      nextSettings.storeDefaultsLocally,
    );
    document.documentElement.lang = nextSettings.uiLanguage;
    applyColorTheme(nextSettings.colorTheme);
    broadcastSettingsSync();

    void setTheme(nextSettings.theme);

    setSavedSettings(nextSettings);
    setSavedEngines(nextEngines);

    if (languageChanged) {
      router.refresh();
    }
  }

  useEffect(() => {
    saveHandlerRef.current = handleSave;
    discardHandlerRef.current = discardChanges;
  });

  useEffect(() => {
    if (!isDirty) {
      toast.dismiss(settingsToastId);
      return;
    }

    toast.custom(
      (toastId) => (
        <div className="flex w-full items-center justify-between gap-4 rounded-full border border-foreground/10 bg-[color-mix(in_oklab,var(--surface-panel)_74%,transparent)] px-5 py-3 text-foreground shadow-[0_18px_60px_rgb(0_0_0_/_0.18)] backdrop-blur-2xl">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/25 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-foreground/70" />
            </span>
            <p className="text-[13.5px] font-medium text-[var(--text-strong)]">
              {t("unsavedChanges")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                toast.dismiss(toastId);
                discardHandlerRef.current();
              }}
              className="cursor-pointer rounded-full px-4 text-[var(--text-soft)] hover:bg-foreground/[0.06] hover:text-[var(--text-strong)]"
            >
              {t("discard")}
            </Button>
            <Button
              variant="inverse"
              size="sm"
              onClick={() => {
                saveHandlerRef.current();
              }}
              className="cursor-pointer rounded-full px-5"
            >
              {t("saveChanges")}
            </Button>
          </div>
        </div>
      ),
      {
        id: settingsToastId,
        duration: Infinity,
        position: "bottom-center",
        style: { width: settingsToastWidth },
        unstyled: true,
      },
    );
  }, [isDirty, t]);

  useEffect(() => {
    return () => {
      toast.dismiss(settingsToastId);
    };
  }, []);

  const activeMeta = navSections.find((s) => s.id === activeSection);

  return (
    <section className="relative mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-6 pt-10 pb-32 sm:px-8 lg:px-10">
      <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-0">
        <aside className="lg:sticky lg:top-8 lg:h-fit lg:border-r lg:border-[var(--surface-panel-border)] lg:pr-8 xl:pr-12">
          <div className="mb-8 px-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-strong)]">
              {t("title")}
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-soft)]">
              {t("subtitle")}
            </p>
          </div>

          <p className="mb-3 px-2.5 text-[11px] font-semibold tracking-[0.08em] text-[var(--text-soft)] uppercase">
            {t("sections")}
          </p>

          <nav
            className="flex flex-col gap-0.5"
            aria-label={t("sectionsAria")}
          >
            {navSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "group/nav relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] font-medium transition-colors",
                    isActive
                      ? "bg-foreground/[0.06] text-[var(--text-strong)]"
                      : "text-[var(--text-body)] hover:bg-foreground/[0.03] hover:text-[var(--text-strong)]",
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-foreground"
                      aria-hidden
                    />
                  )}
                  <Icon
                    className={cn(
                      "size-4 transition-colors",
                      isActive
                        ? "text-[var(--text-strong)]"
                        : "text-[var(--text-soft)] group-hover/nav:text-[var(--text-strong)]",
                    )}
                  />
                  <span className="flex-1">{section.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 hidden pr-2 lg:block">
            <div className="flex items-center gap-2 px-2.5 text-[12px] font-semibold text-[var(--text-soft)]">
              <Info className="size-3.5" />
              {t("cookieDefaultsTitle")}
            </div>
            <p className="mt-1.5 px-2.5 text-[12px] leading-relaxed text-[var(--text-soft)]">
              {t("cookieDefaultsDescription")}
            </p>
          </div>
        </aside>

        <div className="min-w-0 lg:pl-10 xl:pl-14">
          {activeSection === "general" && activeMeta && (
            <div className="space-y-8">
              <SectionHeader
                title={activeMeta.label}
                description={activeMeta.description}
              />

              <div className="divide-y divide-[var(--surface-panel-border)]">
                <SettingRow
                  label={t("general.searchLocaleLabel")}
                  description={t("general.searchLocaleDescription")}
                >
                  <SettingSelect
                    value={settings.locale}
                    onValueChange={(value) => updateSetting("locale", value)}
                    options={[
                      { value: "auto", label: common("languages.auto") },
                      { value: "en", label: common("languages.en") },
                      { value: "de", label: common("languages.de") },
                      { value: "fr", label: common("languages.fr") },
                      { value: "es", label: common("languages.es") },
                      { value: "it", label: common("languages.it") },
                      { value: "en-US", label: common("languages.enUS") },
                      { value: "de-CH", label: common("languages.deCH") },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label={t("general.defaultTabLabel")}
                  description={t("general.defaultTabDescription")}
                >
                  <SettingSelect
                    value={settings.defaultTab}
                    onValueChange={(value) =>
                      updateSetting("defaultTab", value)
                    }
                    options={[
                      { value: "all", label: common("tabs.all") },
                      { value: "images", label: common("tabs.images") },
                      { value: "videos", label: common("tabs.videos") },
                      { value: "news", label: common("tabs.news") },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label={t("general.safeSearchLabel")}
                  description={t("general.safeSearchDescription")}
                >
                  <SettingSelect
                    value={settings.safeSearch}
                    onValueChange={(value) =>
                      updateSetting("safeSearch", value)
                    }
                    options={[
                      { value: "0", label: common("safeSearch.off") },
                      { value: "1", label: common("safeSearch.moderate") },
                      { value: "2", label: common("safeSearch.strict") },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label={t("general.timeRangeLabel")}
                  description={t("general.timeRangeDescription")}
                >
                  <SettingSelect
                    value={settings.timeRange}
                    onValueChange={(value) => updateSetting("timeRange", value)}
                    options={[
                      { value: "any", label: common("timeRanges.any") },
                      { value: "day", label: common("timeRanges.day") },
                      { value: "month", label: common("timeRanges.month") },
                      { value: "year", label: common("timeRanges.year") },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label={t("general.autocompleteLabel")}
                  description={t("general.autocompleteDescription")}
                >
                  <SettingSelect
                    value={settings.autocomplete}
                    onValueChange={(value) =>
                      updateSetting("autocomplete", value)
                    }
                    options={[
                      { value: "google", label: "Google" },
                      { value: "brave", label: "Brave" },
                      { value: "duckduckgo", label: "DuckDuckGo" },
                      { value: "bing", label: "Bing" },
                      { value: "startpage", label: "Startpage" },
                      { value: "qwant", label: "Qwant" },
                      { value: "wikipedia", label: "Wikipedia" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label={t("general.faviconResolverLabel")}
                  description={t("general.faviconResolverDescription")}
                >
                  <SettingSelect
                    value={settings.faviconResolver}
                    onValueChange={(value) =>
                      updateSetting("faviconResolver", value)
                    }
                    options={[
                      { value: "google", label: "Google" },
                      { value: "duckduckgo", label: "DuckDuckGo" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label={t("general.httpMethodLabel")}
                  description={t("general.httpMethodDescription")}
                >
                  <SettingSelect
                    value={normalizeHttpMethod(settings.httpMethod)}
                    onValueChange={(value) =>
                      updateSetting("httpMethod", normalizeHttpMethod(value))
                    }
                    options={[
                      { value: "get", label: "GET" },
                      { value: "post", label: "POST" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label={t("general.loadMoreLabel")}
                  description={t("general.loadMoreDescription")}
                >
                  <SettingSelect
                    value={settings.loadMoreCount}
                    onValueChange={(value) =>
                      updateSetting("loadMoreCount", value)
                    }
                    options={[10, 20, 30, 40].map((count) => ({
                      value: String(count),
                      label: t("general.resultCount", { count }),
                    }))}
                  />
                </SettingRow>
                <SettingRow
                  label={t("general.resultReuseLabel")}
                  description={t("general.resultReuseDescription")}
                >
                  <SettingSelect
                    value={normalizeResultReuseMode(settings.resultReuseMode)}
                    onValueChange={(value) =>
                      updateSetting(
                        "resultReuseMode",
                        normalizeResultReuseMode(value),
                      )
                    }
                    options={[
                      { value: "fresh", label: t("general.fetchFresh") },
                      { value: "cache", label: t("general.cacheVisited") },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label={t("general.engineTokensLabel")}
                  description={t("general.engineTokensDescription")}
                >
                  <p className="max-w-[320px] text-right text-[13px] leading-6 text-[var(--text-soft)]">
                    {t("general.engineTokensHint")}
                  </p>
                </SettingRow>
              </div>
            </div>
          )}

          {activeSection === "interface" && activeMeta && (
            <div className="space-y-8">
              <SectionHeader
                title={activeMeta.label}
                description={activeMeta.description}
              />
              <div className="divide-y divide-[var(--surface-panel-border)]">
                <SettingRow
                  label={t("interface.uiLanguageLabel")}
                  description={t("interface.uiLanguageDescription")}
                >
                  <SettingSelect
                    value={settings.uiLanguage}
                    onValueChange={(value) =>
                      updateSetting("uiLanguage", value)
                    }
                    options={[
                      { value: "en", label: common("languages.en") },
                      { value: "de", label: common("languages.de") },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label={t("interface.appearanceLabel")}
                  description={t("interface.appearanceDescription")}
                >
                  <SettingSelect
                    value={settings.theme}
                    onValueChange={(value) => {
                      if (isAppearanceMode(value)) {
                        updateSetting("theme", value);
                      }
                    }}
                    options={appearanceModes.map((value) => ({
                      value,
                      label: common(`themes.${value}`),
                    }))}
                  />
                </SettingRow>
                <SettingRow
                  label={t("interface.themeLabel")}
                  description={t("interface.themeDescription")}
                >
                  <SettingSelect
                    value={settings.colorTheme}
                    onValueChange={(value) => {
                      if (isColorTheme(value)) {
                        updateSetting("colorTheme", value);
                      }
                    }}
                    options={colorThemes.map(({ label, value }) => ({
                      label,
                      value,
                    }))}
                  />
                </SettingRow>
                <SettingRow
                  label={t("interface.openNewTabLabel")}
                  description={t("interface.openNewTabDescription")}
                >
                  <Toggle
                    checked={settings.openInNewTab}
                    onToggle={() =>
                      updateSetting("openInNewTab", !settings.openInNewTab)
                    }
                    label={t("interface.openNewTabLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("interface.urlFormattingLabel")}
                  description={t("interface.urlFormattingDescription")}
                >
                  <SettingSelect
                    value={normalizeUrlFormattingMode(settings.urlFormatting)}
                    onValueChange={(value) =>
                      updateSetting(
                        "urlFormatting",
                        normalizeUrlFormattingMode(value),
                      )
                    }
                    options={[
                      { value: "pretty", label: common("urlFormats.pretty") },
                      { value: "full", label: common("urlFormats.full") },
                      { value: "host", label: common("urlFormats.host") },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label={t("interface.infiniteScrollLabel")}
                  description={t("interface.infiniteScrollDescription")}
                >
                  <Toggle
                    checked={settings.infiniteScroll}
                    onToggle={() =>
                      updateSetting("infiniteScroll", !settings.infiniteScroll)
                    }
                    label={t("interface.infiniteScrollLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("interface.showFaviconsLabel")}
                  description={t("interface.showFaviconsDescription")}
                >
                  <Toggle
                    checked={settings.showFavicons}
                    onToggle={() =>
                      updateSetting("showFavicons", !settings.showFavicons)
                    }
                    label={t("interface.showFaviconsLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("interface.showThumbnailsLabel")}
                  description={t("interface.showThumbnailsDescription")}
                >
                  <Toggle
                    checked={settings.showThumbnails}
                    onToggle={() =>
                      updateSetting("showThumbnails", !settings.showThumbnails)
                    }
                    label={t("interface.showThumbnailsLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("interface.compactDensityLabel")}
                  description={t("interface.compactDensityDescription")}
                >
                  <Toggle
                    checked={settings.compactDensity}
                    onToggle={() =>
                      updateSetting("compactDensity", !settings.compactDensity)
                    }
                    label={t("interface.compactDensityLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("interface.queryTitleLabel")}
                  description={t("interface.queryTitleDescription")}
                >
                  <Toggle
                    checked={settings.queryInTitle}
                    onToggle={() =>
                      updateSetting("queryInTitle", !settings.queryInTitle)
                    }
                    label={t("interface.queryTitleLabel")}
                  />
                </SettingRow>
              </div>
            </div>
          )}

          {activeSection === "privacy" && activeMeta && (
            <div className="space-y-8">
              <SectionHeader
                title={activeMeta.label}
                description={activeMeta.description}
              />
              <div className="divide-y divide-[var(--surface-panel-border)]">
                <SettingRow
                  label={t("privacy.imageProxyLabel")}
                  description={t("privacy.imageProxyDescription")}
                >
                  <Toggle
                    checked={settings.imageProxy}
                    onToggle={() =>
                      updateSetting("imageProxy", !settings.imageProxy)
                    }
                    label={t("privacy.imageProxyLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("privacy.trackerCleanerLabel")}
                  description={t("privacy.trackerCleanerDescription")}
                >
                  <Toggle
                    checked={settings.trackerCleaner}
                    onToggle={() =>
                      updateSetting("trackerCleaner", !settings.trackerCleaner)
                    }
                    label={t("privacy.trackerCleanerLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("privacy.doiRewriteLabel")}
                  description={t("privacy.doiRewriteDescription")}
                >
                  <Toggle
                    checked={settings.doiRewrite}
                    onToggle={() =>
                      updateSetting("doiRewrite", !settings.doiRewrite)
                    }
                    label={t("privacy.doiRewriteLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("privacy.storeDefaultsLabel")}
                  description={t("privacy.storeDefaultsDescription")}
                >
                  <Toggle
                    checked={settings.storeDefaultsLocally}
                    onToggle={() =>
                      updateSetting(
                        "storeDefaultsLocally",
                        !settings.storeDefaultsLocally,
                      )
                    }
                    label={t("privacy.storeDefaultsLabel")}
                  />
                </SettingRow>
              </div>
            </div>
          )}

          {activeSection === "engines" && activeMeta && (
            <div className="space-y-6">
              <SectionHeader
                title={t("engines.title")}
                description={t("engines.description")}
              />

              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--text-soft)]" />
                <Input
                  value={engineFilter}
                  onChange={(event) => setEngineFilter(event.target.value)}
                  placeholder={t("engines.filterPlaceholder")}
                  className="h-10 rounded-xl border-[var(--surface-panel-border)] bg-background pl-10 text-[14px] shadow-none hover:border-foreground/20 focus-visible:border-foreground/30 focus-visible:ring-foreground/5"
                />
              </div>

              <div
                role="tablist"
                aria-label={t("engines.categoriesAria")}
                className="flex gap-0 overflow-x-auto border-b border-[var(--surface-panel-border)]"
              >
                {engineGroupOrder.map((key, index) => {
                  const meta = engineGroupMeta[key];
                  const Icon = meta.icon;
                  const isActive = activeEngineGroup === key;

                  return (
                    <div key={key} className="flex shrink-0 items-center">
                      {index > 0 ? (
                        <span className="mx-5 h-5 w-px bg-[var(--surface-panel-border)]" />
                      ) : null}
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveEngineGroup(key)}
                        className={cn(
                          "inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-0 text-[14px] font-medium transition-colors",
                          isActive
                            ? "border-foreground text-[var(--text-strong)]"
                            : "border-transparent text-[var(--text-soft)] hover:text-[var(--text-strong)]",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                        <span>{meta.title}</span>
                        <span className="text-[12px] text-[var(--text-soft)]">
                          {engines[key].size}/{engineCatalog[key].length}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <div role="tabpanel">
                <EngineRows
                  groupKey={activeEngineGroup}
                  filter={engineFilter}
                  selected={engines[activeEngineGroup]}
                  onToggle={(engine) => toggleEngine(activeEngineGroup, engine)}
                />
              </div>
            </div>
          )}

          {activeSection === "special" && activeMeta && (
            <div className="space-y-8">
              <SectionHeader
                title={t("special.title")}
                description={t("special.description")}
              />
              <div className="divide-y divide-[var(--surface-panel-border)]">
                <SettingRow
                  label={t("special.calculatorLabel")}
                  description={t("special.calculatorDescription")}
                >
                  <Toggle
                    checked={settings.calculator}
                    onToggle={() =>
                      updateSetting("calculator", !settings.calculator)
                    }
                    label={t("special.calculatorLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("special.unitConverterLabel")}
                  description={t("special.unitConverterDescription")}
                >
                  <Toggle
                    checked={settings.unitConverter}
                    onToggle={() =>
                      updateSetting("unitConverter", !settings.unitConverter)
                    }
                    label={t("special.unitConverterLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("special.hashLookupLabel")}
                  description={t("special.hashLookupDescription")}
                >
                  <Toggle
                    checked={settings.hashSearch}
                    onToggle={() =>
                      updateSetting("hashSearch", !settings.hashSearch)
                    }
                    label={t("special.hashLookupLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("special.selfInfoLabel")}
                  description={t("special.selfInfoDescription")}
                >
                  <Toggle
                    checked={settings.selfInfo}
                    onToggle={() =>
                      updateSetting("selfInfo", !settings.selfInfo)
                    }
                    label={t("special.selfInfoLabel")}
                  />
                </SettingRow>
                <SettingRow
                  label={t("special.timeZoneLabel")}
                  description={t("special.timeZoneDescription")}
                >
                  <Toggle
                    checked={settings.timeZone}
                    onToggle={() =>
                      updateSetting("timeZone", !settings.timeZone)
                    }
                    label={t("special.timeZoneLabel")}
                  />
                </SettingRow>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
