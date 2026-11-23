import { SegmentedControl } from "@homeowner/bedrock";
import { useI18n } from "./i18n/I18nProvider";
import { LOCALES, isLocale } from "./i18n/i18n";
import { useTheme } from "./theme/ThemeProvider";
import { isThemeChoice, THEME_CHOICES } from "./theme/theme";

const LANGUAGE_NAME = { "pt-BR": "Português", en: "English" } as const;

/** Language and appearance. Shown on the sign-in screens, side by side, and in Settings as two rows: the label on the left on desktop, above a full-width control on a phone. */
export function Preferences({ rows }: { rows?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const { choice, setChoice } = useTheme();
  const language = (
    <SegmentedControl
      block={rows}
      label={t("prefs.language")}
      value={locale}
      onValueChange={(v) => isLocale(v) && setLocale(v)}
      options={LOCALES.map((value) => ({ value, label: LANGUAGE_NAME[value] }))}
    />
  );
  const theme = (
    <SegmentedControl
      block={rows}
      label={t("prefs.theme")}
      value={choice}
      onValueChange={(v) => isThemeChoice(v) && setChoice(v)}
      options={THEME_CHOICES.map((value) => ({ value, label: t(`prefs.theme.${value}`) }))}
    />
  );
  if (!rows)
    return (
      <div className="flex flex-wrap gap-4">
        {language}
        {theme}
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 desktop:flex-row desktop:items-center desktop:justify-between">
        <span className="body">{t("prefs.theme")}</span>
        <div className="desktop:w-auto">{theme}</div>
      </div>
      <hr className="border-border" />
      <div className="flex flex-col gap-2 desktop:flex-row desktop:items-center desktop:justify-between">
        <span className="body">{t("prefs.language")}</span>
        <div className="desktop:w-auto">{language}</div>
      </div>
    </div>
  );
}
