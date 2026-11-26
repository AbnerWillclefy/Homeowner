import { SegmentedControl } from "@homeowner/bedrock";
import { Languages, Palette, Settings2 } from "lucide-react";
import { IconTile } from "../../../shared/ui/IconTile";
import { SheetRow } from "../../../shared/ui/SheetRow";
import { useUndoable } from "../../../shared/undo/useUndoable";
import { SectionCard } from "../../../shared/ui/SectionCard";
import { isLocale, LANGUAGE_NAME, LOCALES, useI18n, type MessageKey } from "../../../shared/i18n";
import { THEME_CHOICES, isThemeChoice, useTheme, type ThemeChoice } from "../../../shared/theme";

const CHOICE_KEY: Record<ThemeChoice, MessageKey> = {
  system: "settings.appearance.system",
  light: "settings.appearance.light",
  dark: "settings.appearance.dark",
};

// A select inside a row sizes to its options, not to the whole width.
const IN_ROW = "mt-0 w-auto max-w-full";

// A setting's name on the left and its select on the right, wrapping under it when the text is large.
const ROW = "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3";

function AppearanceSelect({ className }: { className?: string }) {
  const { t } = useI18n();
  const { choice, setChoice } = useTheme();
  return (
    <select
      id="settings-appearance"
      className={className}
      value={choice}
      onChange={(event) => {
        if (isThemeChoice(event.target.value)) setChoice(event.target.value);
      }}
    >
      {THEME_CHOICES.map((value) => (
        <option key={value} value={value}>
          {t(CHOICE_KEY[value])}
        </option>
      ))}
    </select>
  );
}

function LanguageSelect({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  return (
    <select
      id="settings-language"
      className={className}
      value={locale}
      onChange={(event) => {
        if (isLocale(event.target.value)) setLocale(event.target.value);
      }}
    >
      {LOCALES.map((tag) => (
        <option key={tag} value={tag} lang={tag}>
          {LANGUAGE_NAME[tag]}
        </option>
      ))}
    </select>
  );
}

/** The Appearance control: one labelled native select, no heading or card, so any layout can place it. */
export function AppearanceSetting() {
  const { t } = useI18n();
  return (
    <div>
      <label htmlFor="settings-appearance">{t("settings.appearance.label")}</label>
      <AppearanceSelect />
    </div>
  );
}

/** The Language control: one labelled native select, no heading or card. */
export function LanguageSetting() {
  const { t } = useI18n();
  return (
    <div>
      <label htmlFor="settings-language">{t("settings.language.label")}</label>
      <LanguageSelect />
    </div>
  );
}

/**
 * Both settings under one Settings heading, for the onboarding screens. The signed-out screens use
 * `SettingsCard` instead; the Me tab uses `LanguageRow` and `ThemeRow`.
 */
export function Settings() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading">{t("settings.heading")}</h2>
      <AppearanceSetting />
      <LanguageSetting />
    </section>
  );
}

/** Appearance and Language on the signed-out screens: one titled card, a row each, the name on the left as its label. */
export function SettingsCard({ headingLevel }: { headingLevel?: 3 | 4 }) {
  const { t } = useI18n();
  return (
    <SectionCard id="settings-card-heading" icon={Settings2} title={t("settings.heading")} headingLevel={headingLevel}>
      <div className="flex flex-col divide-y divide-border/30">
        <div className={ROW}>
          <label htmlFor="settings-appearance" className="mt-0">
            {t("settings.appearance.label")}
          </label>
          <AppearanceSelect className={IN_ROW} />
        </div>
        <div className={ROW}>
          <label htmlFor="settings-language" className="mt-0">
            {t("settings.language.label")}
          </label>
          <LanguageSelect className={IN_ROW} />
        </div>
      </div>
    </SectionCard>
  );
}

const LOCAL_OK = () => Promise.resolve({ kind: "ok" });
const TILE = "bg-surface-sunken text-text-muted";

/**
 * Appearance as a row of Me that opens a Sheet. The choice applies at once and is local (`homeowner.theme`), and
 * its toast's Desfazer writes the old choice back; there is no request, so nothing can fail.
 */
export function ThemeRow() {
  const { t } = useI18n();
  const { choice, setChoice } = useTheme();
  const { undoableChange } = useUndoable();
  function pick(next: string) {
    if (!isThemeChoice(next) || next === choice) return;
    const before = choice;
    void undoableChange({
      key: "setting:theme",
      titleKey: "profile.saved",
      failedKey: "profile.saveFailed",
      apply: () => setChoice(next),
      revert: () => setChoice(before),
      send: LOCAL_OK,
      sendRevert: LOCAL_OK,
    });
  }
  return (
    <SheetRow
      icon={<IconTile icon={Palette} className={TILE} />}
      title={t("settings.appearance.label")}
      caption={t(CHOICE_KEY[choice])}
    >
      <SegmentedControl
        block
        label={t("settings.appearance.label")}
        options={THEME_CHOICES.map((value) => ({ value, label: t(CHOICE_KEY[value]) }))}
        value={choice}
        onValueChange={pick}
      />
    </SheetRow>
  );
}

/** Language as a row of Me that opens a Sheet; local like `ThemeRow`, and Desfazer writes the old language back. */
export function LanguageRow() {
  const { t, locale, setLocale } = useI18n();
  const { undoableChange } = useUndoable();
  function pick(next: string) {
    if (!isLocale(next) || next === locale) return;
    const before = locale;
    void undoableChange({
      key: "setting:language",
      titleKey: "profile.saved",
      failedKey: "profile.saveFailed",
      apply: () => setLocale(next),
      revert: () => setLocale(before),
      send: LOCAL_OK,
      sendRevert: LOCAL_OK,
    });
  }
  return (
    <SheetRow
      icon={<IconTile icon={Languages} className={TILE} />}
      title={t("settings.language.label")}
      caption={LANGUAGE_NAME[locale]}
    >
      <SegmentedControl
        block
        label={t("settings.language.label")}
        options={LOCALES.map((tag) => ({ value: tag, label: LANGUAGE_NAME[tag] }))}
        value={locale}
        onValueChange={pick}
      />
    </SheetRow>
  );
}
