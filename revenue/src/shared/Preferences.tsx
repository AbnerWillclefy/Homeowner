import { SegmentedControl } from "@homeowner/bedrock";
import { useI18n } from "./i18n/I18nProvider";
import { LOCALES, isLocale } from "./i18n/i18n";
import { useTheme } from "./theme/ThemeProvider";
import { isThemeChoice, THEME_CHOICES } from "./theme/theme";

const LANGUAGE_NAME = { "pt-BR": "Português", en: "English" } as const;

/** Language and appearance. Shown on the sign-in screens and in Settings. */
export function Preferences() {
  const { t, locale, setLocale } = useI18n();
  const { choice, setChoice } = useTheme();
  return (
    <div className="flex flex-wrap gap-4">
      <SegmentedControl
        label={t("prefs.language")}
        value={locale}
        onValueChange={(v) => isLocale(v) && setLocale(v)}
        options={LOCALES.map((value) => ({ value, label: LANGUAGE_NAME[value] }))}
      />
      <SegmentedControl
        label={t("prefs.theme")}
        value={choice}
        onValueChange={(v) => isThemeChoice(v) && setChoice(v)}
        options={THEME_CHOICES.map((value) => ({ value, label: t(`prefs.theme.${value}`) }))}
      />
    </div>
  );
}
