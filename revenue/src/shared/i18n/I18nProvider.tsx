import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { isLocale, readStoredLocale, resolveLocale, translate, writeStoredLocale, type Locale, type Translate } from "./i18n";

interface I18n {
  locale: Locale;
  setLocale(next: Locale): void;
  t: Translate;
}

const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n needs an I18nProvider");
  return value;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Read once, during the first render, so a stored choice never flashes the default.
  const [locale, setLocaleState] = useState(() => resolveLocale(readStoredLocale(), navigator.languages ?? []));

  // Screen readers pick their voice from this, so it must match what is shown.
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    writeStoredLocale(next);
  }, []);
  const value = useMemo<I18n>(() => ({ locale, setLocale, t: (key, params) => translate(locale, key, params) }), [locale, setLocale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}
