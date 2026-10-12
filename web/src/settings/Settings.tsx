import { Card } from "../components/ui/Card";
import { isLocale, LANGUAGE_NAME, LOCALES, useI18n, type MessageKey } from "../i18n";
import { THEME_CHOICES, isThemeChoice, useTheme, type ThemeChoice } from "../theme";

const CHOICE_KEY: Record<ThemeChoice, MessageKey> = {
  system: "settings.appearance.system",
  light: "settings.appearance.light",
  dark: "settings.appearance.dark",
};

/** The Appearance control: one labelled native select, no heading or card, so any layout can place it. */
export function AppearanceSetting() {
  const { t } = useI18n();
  const { choice, setChoice } = useTheme();
  return (
    <div>
      <label htmlFor="settings-appearance">{t("settings.appearance.label")}</label>
      <select
        id="settings-appearance"
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
    </div>
  );
}

/** The Language control: one labelled native select, no heading or card. */
export function LanguageSetting() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div>
      <label htmlFor="settings-language">{t("settings.language.label")}</label>
      <select
        id="settings-language"
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
    </div>
  );
}

/**
 * Both settings under one Settings heading, for the sign-in and welcome screens. The Me tab does not use
 * this: it puts each setting in its own titled card.
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

/** Appearance on the Me tab: a titled card holding the control. The title repeats the visible label on purpose. */
export function AppearanceCard() {
  const { t } = useI18n();
  return (
    <Card as="section" aria-labelledby="me-appearance-heading">
      <h2 id="me-appearance-heading">{t("settings.appearance.label")}</h2>
      <AppearanceSetting />
    </Card>
  );
}

/** Language on the Me tab: a titled card holding the control. */
export function LanguageCard() {
  const { t } = useI18n();
  return (
    <Card as="section" aria-labelledby="me-language-heading">
      <h2 id="me-language-heading">{t("settings.language.label")}</h2>
      <LanguageSetting />
    </Card>
  );
}
