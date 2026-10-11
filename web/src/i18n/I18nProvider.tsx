import { useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { enUS } from "./catalogs/en-US";
import { ptBR } from "./catalogs/pt-BR";
import { browserLanguages } from "./browserLanguages";
import { I18nContext, type I18n } from "./context";
import { resolveLocale } from "./resolveLocale";
import { createTranslate, type Catalogs } from "./translate";

// Both catalogs are imported statically so they ship in the precached main chunk
// and both languages work offline.
const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);

export function I18nProvider({ children }: { children: ReactNode }) {
  // The setter is not exposed yet; the language picker (#50) will add it.
  const [locale] = useState(() => resolveLocale({ languages: browserLanguages() }));

  // Screen readers pick their voice from this, so it must match what is shown.
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18n>(
    () => ({ locale, t: (key, params) => translate(locale, key, params) }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
