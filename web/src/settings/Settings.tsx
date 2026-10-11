import { isLocale, LANGUAGE_NAME, LOCALES, useI18n, type MessageKey } from "../i18n";
import { THEME_CHOICES, isThemeChoice, useTheme, type ThemeChoice } from "../theme";

const CHOICE_KEY: Record<ThemeChoice, MessageKey> = {
  system: "settings.appearance.system",
  light: "settings.appearance.light",
  dark: "settings.appearance.dark",
};

/**
 * The Settings section at the bottom of the home screen. Each setting is one labelled row
 * with a native control: Appearance, then Language.
 */
export function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { choice, setChoice } = useTheme();

  return (
    <section aria-labelledby="settings-heading">
      <h2 id="settings-heading">{t("settings.heading")}</h2>
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
    </section>
  );
}
