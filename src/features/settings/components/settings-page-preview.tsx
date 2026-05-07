"use client";

import {
  Check,
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
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
  UI_LANGUAGE_EVENT,
} from "@/features/settings/lib/preferences";
import {
  broadcastSettingsSync,
  persistPreferencesCookie as persistCookie,
  persistSettingsStorageMode,
  persistUiLanguagePreference,
  readUiLanguagePreference,
} from "@/features/settings/lib/preferences-client";
import { cn } from "@/lib/utils";

type SectionId = "general" | "interface" | "privacy" | "engines" | "special";

const navSections: Array<{
  id: SectionId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "general",
    label: "General",
    description: "Locale, default tab, and result defaults.",
    icon: Globe,
  },
  {
    id: "interface",
    label: "Interface",
    description: "Theme, density, and result link behavior.",
    icon: Palette,
  },
  {
    id: "privacy",
    label: "Privacy",
    description: "Proxying, tracker cleaning, and local storage.",
    icon: ShieldCheck,
  },
  {
    id: "engines",
    label: "Engines",
    description: "Per-category engine selection.",
    icon: Monitor,
  },
  {
    id: "special",
    label: "Special queries",
    description: "Calculator, converters, and quick answers.",
    icon: Sparkles,
  },
];

const engineGroupMeta: Record<
  EngineGroupKey,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  general: {
    title: "General",
    description: "Web search and direct-answer style sources.",
    icon: Search,
  },
  images: {
    title: "Images",
    description: "Image search providers and alternates.",
    icon: ImageIcon,
  },
  videos: {
    title: "Videos",
    description: "Video result backends, including optional alternates.",
    icon: Video,
  },
  news: {
    title: "News",
    description: "News-specific engines and publishers.",
    icon: Newspaper,
  },
};

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

type EngineGroupProps = {
  groupKey: EngineGroupKey;
  filter: string;
  selected: Set<string>;
  onToggle: (engine: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
};

function EngineGroup({
  groupKey,
  filter,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: EngineGroupProps) {
  const meta = engineGroupMeta[groupKey];
  const Icon = meta.icon;
  const allEngines = engineCatalog[groupKey];
  const filtered = filter
    ? allEngines.filter((engine) =>
        engine.toLowerCase().includes(filter.toLowerCase()),
      )
    : allEngines;

  return (
    <div className="rounded-2xl border border-[var(--surface-panel-border)] bg-[var(--surface-panel)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--surface-panel-border)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-[var(--text-soft)]" />
            <h3 className="text-[14.5px] font-semibold text-[var(--text-strong)]">
              {meta.title}
            </h3>
            <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-[var(--text-soft)] ring-1 ring-[var(--surface-panel-border)]">
              {selected.size}/{allEngines.length}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-soft)]">
            {meta.description}
          </p>
        </div>
        <div className="flex shrink-0 gap-1 text-[12px]">
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-full px-2.5 py-1 font-medium text-[var(--text-soft)] transition-colors hover:bg-background hover:text-[var(--text-strong)]"
          >
            All
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-2.5 py-1 font-medium text-[var(--text-soft)] transition-colors hover:bg-background hover:text-[var(--text-strong)]"
          >
            None
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {filtered.length === 0 ? (
          <p className="py-2 text-[13px] text-[var(--text-soft)]">
            No engines match your filter.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filtered.map((engine) => {
              const isActive = selected.has(engine);
              return (
                <button
                  key={engine}
                  type="button"
                  onClick={() => onToggle(engine)}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all",
                    isActive
                      ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
                      : "border-[var(--surface-chip-border)] bg-background text-[var(--text-body)] hover:border-foreground/30 hover:text-[var(--text-strong)]",
                  )}
                >
                  {isActive && (
                    <Check className="size-3 stroke-[3]" aria-hidden />
                  )}
                  {engine}
                </button>
              );
            })}
          </div>
        )}
      </div>
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
  const { resolvedTheme, setTheme } = useTheme();
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

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
      !resolvedTheme ||
      (resolvedTheme !== "light" && resolvedTheme !== "dark")
    ) {
      return;
    }

    setSettings((current) =>
      current.theme === resolvedTheme
        ? current
        : { ...current, theme: resolvedTheme },
    );
    setSavedSettings((current) =>
      current.theme === resolvedTheme
        ? current
        : { ...current, theme: resolvedTheme },
    );
  }, [resolvedTheme]);

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

  function setEngineGroup(group: EngineGroupKey, next: Set<string>) {
    setEngines((current) => ({ ...current, [group]: next }));
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
    window.dispatchEvent(
      new CustomEvent(UI_LANGUAGE_EVENT, {
        detail: { language: nextSettings.uiLanguage },
      }),
    );
    broadcastSettingsSync();

    void setTheme(nextSettings.theme);

    setSavedSettings(nextSettings);
    setSavedEngines(nextEngines);
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
              You have unsaved changes
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
              Discard
            </Button>
            <Button
              variant="inverse"
              size="sm"
              onClick={() => {
                saveHandlerRef.current();
              }}
              className="cursor-pointer rounded-full px-5"
            >
              Save changes
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
  }, [isDirty]);

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
              Settings
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-soft)]">
              Customize how AdminSearch searches, displays, and handles results.
            </p>
          </div>

          <p className="mb-3 px-2.5 text-[11px] font-semibold tracking-[0.08em] text-[var(--text-soft)] uppercase">
            Sections
          </p>

          <nav className="flex flex-col gap-0.5" aria-label="Settings sections">
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
              Cookie-backed defaults
            </div>
            <p className="mt-1.5 px-2.5 text-[12px] leading-relaxed text-[var(--text-soft)]">
              Saved settings are persisted in your browser. The subset already
              supported by the current search pipeline is applied as default
              behavior.
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
                  label="Search locale"
                  description="Locale-style values so region-aware engines can be added later."
                >
                  <SettingSelect
                    value={settings.locale}
                    onValueChange={(value) => updateSetting("locale", value)}
                    options={[
                      { value: "auto", label: "Auto" },
                      { value: "en", label: "English" },
                      { value: "de", label: "German" },
                      { value: "fr", label: "French" },
                      { value: "es", label: "Spanish" },
                      { value: "it", label: "Italian" },
                      { value: "en-US", label: "English (US)" },
                      { value: "de-CH", label: "German (Switzerland)" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label="Default tab"
                  description="The landing tab for a new search."
                >
                  <SettingSelect
                    value={settings.defaultTab}
                    onValueChange={(value) =>
                      updateSetting("defaultTab", value)
                    }
                    options={[
                      { value: "all", label: "All" },
                      { value: "images", label: "Images" },
                      { value: "videos", label: "Videos" },
                      { value: "news", label: "News" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label="SafeSearch"
                  description="Default content filtering level for searches."
                >
                  <SettingSelect
                    value={settings.safeSearch}
                    onValueChange={(value) =>
                      updateSetting("safeSearch", value)
                    }
                    options={[
                      { value: "0", label: "Off" },
                      { value: "1", label: "Moderate" },
                      { value: "2", label: "Strict" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label="Default time range"
                  description="Applied automatically until you override it from the search page."
                >
                  <SettingSelect
                    value={settings.timeRange}
                    onValueChange={(value) => updateSetting("timeRange", value)}
                    options={[
                      { value: "any", label: "Any time" },
                      { value: "day", label: "Past day" },
                      { value: "month", label: "Past month" },
                      { value: "year", label: "Past year" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label="Autocomplete"
                  description="Suggestion backend used while typing."
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
                  label="Favicon resolver"
                  description="Which upstream resolver fetches favicons for result rows."
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
                  label="HTTP method"
                  description="How AdminSearch sends search requests to the SearXNG backend."
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
                  label="Load more size"
                  description="Batch size for appended results when loading more."
                >
                  <SettingSelect
                    value={settings.loadMoreCount}
                    onValueChange={(value) =>
                      updateSetting("loadMoreCount", value)
                    }
                    options={[
                      { value: "10", label: "10 results" },
                      { value: "20", label: "20 results" },
                      { value: "30", label: "30 results" },
                      { value: "40", label: "40 results" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label="Result reuse"
                  description="Choose whether revisiting an already loaded search view fetches again or restores cached results for 30 minutes."
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
                      { value: "fresh", label: "Fetch fresh results" },
                      { value: "cache", label: "Cache visited results" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label="Engine tokens"
                  description="Comma-separated access tokens for private engines, matching SearXNG's own preference model."
                >
                  <Input
                    value={settings.engineTokens}
                    onChange={(event) =>
                      updateSetting("engineTokens", event.target.value)
                    }
                    placeholder="private-token-a, private-token-b"
                    className="h-10 w-full min-w-[260px] rounded-xl border-[var(--surface-panel-border)] bg-background px-3.5 text-[14px] shadow-none hover:border-foreground/20 focus-visible:border-foreground/30 focus-visible:ring-foreground/5"
                  />
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
                  label="UI language"
                  description="AdminSearch interface language, separate from search locale."
                >
                  <SettingSelect
                    value={settings.uiLanguage}
                    onValueChange={(value) =>
                      updateSetting("uiLanguage", value)
                    }
                    options={[
                      { value: "en", label: "English" },
                      { value: "de", label: "German" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label="Theme"
                  description="Own the app theme here instead of mirroring SearXNG's native UI theme."
                >
                  <SettingSelect
                    value={settings.theme}
                    onValueChange={(value) => updateSetting("theme", value)}
                    options={[
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label="Open results in new tab"
                  description="Links from results open in a new browser tab."
                >
                  <Toggle
                    checked={settings.openInNewTab}
                    onToggle={() =>
                      updateSetting("openInNewTab", !settings.openInNewTab)
                    }
                    label="Open results in new tab"
                  />
                </SettingRow>
                <SettingRow
                  label="URL formatting"
                  description="Choose how result URLs are displayed below each title."
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
                      { value: "pretty", label: "Pretty" },
                      { value: "full", label: "Full" },
                      { value: "host", label: "Host" },
                    ]}
                  />
                </SettingRow>
                <SettingRow
                  label="Infinite scroll"
                  description="Automatically load more results when you reach the end of the list."
                >
                  <Toggle
                    checked={settings.infiniteScroll}
                    onToggle={() =>
                      updateSetting("infiniteScroll", !settings.infiniteScroll)
                    }
                    label="Infinite scroll"
                  />
                </SettingRow>
                <SettingRow
                  label="Show favicons"
                  description="Useful on web and news results; less important on image-heavy views."
                >
                  <Toggle
                    checked={settings.showFavicons}
                    onToggle={() =>
                      updateSetting("showFavicons", !settings.showFavicons)
                    }
                    label="Show favicons"
                  />
                </SettingRow>
                <SettingRow
                  label="Show thumbnails"
                  description="Media thumbnails on result cards."
                >
                  <Toggle
                    checked={settings.showThumbnails}
                    onToggle={() =>
                      updateSetting("showThumbnails", !settings.showThumbnails)
                    }
                    label="Show thumbnails"
                  />
                </SettingRow>
                <SettingRow
                  label="Compact density"
                  description="Denser results layout with tighter spacing."
                >
                  <Toggle
                    checked={settings.compactDensity}
                    onToggle={() =>
                      updateSetting("compactDensity", !settings.compactDensity)
                    }
                    label="Compact density"
                  />
                </SettingRow>
                <SettingRow
                  label="Query in tab title"
                  description="Include the current search query in the browser tab title."
                >
                  <Toggle
                    checked={settings.queryInTitle}
                    onToggle={() =>
                      updateSetting("queryInTitle", !settings.queryInTitle)
                    }
                    label="Query in tab title"
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
                  label="Image proxy"
                  description="Proxy remote result images through the backend instead of loading directly from origin sites."
                >
                  <Toggle
                    checked={settings.imageProxy}
                    onToggle={() =>
                      updateSetting("imageProxy", !settings.imageProxy)
                    }
                    label="Image proxy"
                  />
                </SettingRow>
                <SettingRow
                  label="Tracker URL cleaner"
                  description="Strip known tracking parameters from outgoing result URLs."
                >
                  <Toggle
                    checked={settings.trackerCleaner}
                    onToggle={() =>
                      updateSetting("trackerCleaner", !settings.trackerCleaner)
                    }
                    label="Tracker URL cleaner"
                  />
                </SettingRow>
                <SettingRow
                  label="Open Access DOI rewrite"
                  description="Prefer open-access DOI mirrors when available."
                >
                  <Toggle
                    checked={settings.doiRewrite}
                    onToggle={() =>
                      updateSetting("doiRewrite", !settings.doiRewrite)
                    }
                    label="Open Access DOI rewrite"
                  />
                </SettingRow>
                <SettingRow
                  label="Store defaults locally"
                  description="Persist settings across browser restarts. Disable this to keep them only for the current browser session."
                >
                  <Toggle
                    checked={settings.storeDefaultsLocally}
                    onToggle={() =>
                      updateSetting(
                        "storeDefaultsLocally",
                        !settings.storeDefaultsLocally,
                      )
                    }
                    label="Store defaults locally"
                  />
                </SettingRow>
              </div>
            </div>
          )}

          {activeSection === "engines" && activeMeta && (
            <div className="space-y-6">
              <SectionHeader
                title="Engines"
                description="Pick which engines run for each search category. Based on the engines enabled in your SearXNG config."
              />

              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[var(--text-soft)]" />
                <Input
                  value={engineFilter}
                  onChange={(event) => setEngineFilter(event.target.value)}
                  placeholder="Filter engines..."
                  className="h-10 rounded-xl border-[var(--surface-panel-border)] bg-background pl-10 text-[14px] shadow-none hover:border-foreground/20 focus-visible:border-foreground/30 focus-visible:ring-foreground/5"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {(Object.keys(engineCatalog) as EngineGroupKey[]).map((key) => (
                  <EngineGroup
                    key={key}
                    groupKey={key}
                    filter={engineFilter}
                    selected={engines[key]}
                    onToggle={(engine) => toggleEngine(key, engine)}
                    onSelectAll={() =>
                      setEngineGroup(key, new Set(engineCatalog[key]))
                    }
                    onClear={() => setEngineGroup(key, new Set())}
                  />
                ))}
              </div>
            </div>
          )}

          {activeSection === "special" && activeMeta && (
            <div className="space-y-8">
              <SectionHeader
                title="Special queries"
                description="Inline helpers that answer simple questions inside search results."
              />
              <div className="divide-y divide-[var(--surface-panel-border)]">
                <SettingRow
                  label="Calculator"
                  description="Quick math answers inside search results."
                >
                  <Toggle
                    checked={settings.calculator}
                    onToggle={() =>
                      updateSetting("calculator", !settings.calculator)
                    }
                    label="Calculator"
                  />
                </SettingRow>
                <SettingRow
                  label="Unit converter"
                  description="Convert between units directly from queries."
                >
                  <Toggle
                    checked={settings.unitConverter}
                    onToggle={() =>
                      updateSetting("unitConverter", !settings.unitConverter)
                    }
                    label="Unit converter"
                  />
                </SettingRow>
                <SettingRow
                  label="Hash lookup"
                  description="Useful for known-hash quick checks."
                >
                  <Toggle
                    checked={settings.hashSearch}
                    onToggle={() =>
                      updateSetting("hashSearch", !settings.hashSearch)
                    }
                    label="Hash lookup"
                  />
                </SettingRow>
                <SettingRow
                  label="Self info"
                  description="Instance-provided helper information and shortcuts."
                >
                  <Toggle
                    checked={settings.selfInfo}
                    onToggle={() =>
                      updateSetting("selfInfo", !settings.selfInfo)
                    }
                    label="Self info"
                  />
                </SettingRow>
                <SettingRow
                  label="Time zone"
                  description="Timezone-aware quick answers and conversions."
                >
                  <Toggle
                    checked={settings.timeZone}
                    onToggle={() =>
                      updateSetting("timeZone", !settings.timeZone)
                    }
                    label="Time zone"
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
