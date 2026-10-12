import { Settings2 } from "lucide-react";
import { SectionCard } from "../shared/ui/SectionCard";
import { isLocale, LANGUAGE_NAME, LOCALES, useI18n, type MessageKey } from "../shared/i18n";
import { THEME_CHOICES, isThemeChoice, useTheme, type ThemeChoice } from "../shared/theme";

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
 * Both settings under one Settings heading, for the onboarding screens. The Me tab and the signed-out
 * screens use `SettingsCard` instead.
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

/** Appearance and Language on the Me tab and the signed-out screens: one titled card, a row each, the name on the left as its label. */
export function SettingsCard() {
  const { t } = useI18n();
  return (
    <SectionCard id="settings-card-heading" icon={Settings2} title={t("settings.heading")}>
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
