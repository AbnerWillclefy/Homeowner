import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { enUS } from "./catalogs/en-US";
import { ptBR } from "./catalogs/pt-BR";
import { browserLanguages } from "./browserLanguages";
import { I18nContext, type I18n } from "./context";
import { LOCALE_STORAGE_KEY, readStoredLocale, writeStoredLocale } from "./localeStorage";
import { isLocale, type Locale } from "./locales";
import { resolveLocale } from "./resolveLocale";
import { createTranslate, type Catalogs } from "./translate";

// Both catalogs are imported statically so they ship in the precached main chunk
// and both languages work offline.
const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Read once, during the first render, so a stored choice never flashes the browser language.
  const [locale, setLocaleState] = useState(() =>
    resolveLocale({ languages: browserLanguages(), stored: readStoredLocale() }),
  );

  // Screen readers pick their voice from this, so it must match what is shown.
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Keep a second tab or window in step. State only: never write back, so there is no loop.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY && isLocale(event.newValue)) {
        setLocaleState(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // State first, so a storage failure can never stop the switch.
  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    writeStoredLocale(next);
  }, []);

  const value = useMemo<I18n>(
    () => ({ locale, setLocale, t: (key, params) => translate(locale, key, params) }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
