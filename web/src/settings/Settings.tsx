import { CardRow } from "../components/ui/CardRow";
import { isLocale, LANGUAGE_NAME, LOCALES, useI18n, type MessageKey } from "../i18n";
import { THEME_CHOICES, isThemeChoice, useTheme, type ThemeChoice } from "../theme";

const CHOICE_KEY: Record<ThemeChoice, MessageKey> = {
  system: "settings.appearance.system",
  light: "settings.appearance.light",
  dark: "settings.appearance.dark",
};

// A select inside a card row sizes to its options, not to the whole width.
const IN_ROW = "mt-0 w-auto max-w-full";

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

/** Appearance on the Me tab: the name on the left, the control on the right. The heading is the control's label. */
export function AppearanceCard() {
  const { t } = useI18n();
  return (
    <CardRow
      as="section"
      aria-labelledby="me-appearance-heading"
      className="items-center"
      actions={<AppearanceSelect className={IN_ROW} />}
    >
      <h2 id="me-appearance-heading" className="my-0">
        <label htmlFor="settings-appearance" className="mt-0">
          {t("settings.appearance.label")}
        </label>
      </h2>
    </CardRow>
  );
}

/** Language on the Me tab: the name on the left, the control on the right. */
export function LanguageCard() {
  const { t } = useI18n();
  return (
    <CardRow
      as="section"
      aria-labelledby="me-language-heading"
      className="items-center"
      actions={<LanguageSelect className={IN_ROW} />}
    >
      <h2 id="me-language-heading" className="my-0">
        <label htmlFor="settings-language" className="mt-0">
          {t("settings.language.label")}
        </label>
      </h2>
    </CardRow>
  );
}
