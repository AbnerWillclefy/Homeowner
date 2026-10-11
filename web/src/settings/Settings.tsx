import { useI18n, type MessageKey } from "../i18n";
import { THEME_CHOICES, isThemeChoice, useTheme, type ThemeChoice } from "../theme";

const CHOICE_KEY: Record<ThemeChoice, MessageKey> = {
  system: "settings.appearance.system",
  light: "settings.appearance.light",
  dark: "settings.appearance.dark",
};

/**
 * The Settings section at the bottom of the home screen. Each setting is one labelled row
 * with a native control; the language selector (#50) adds a row after Appearance.
 */
export function Settings() {
  const { t } = useI18n();
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
    </section>
  );
}
