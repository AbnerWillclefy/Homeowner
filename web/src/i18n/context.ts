import { createContext } from "react";
import type { MessageKey } from "./catalogs/en-US";
import type { Locale } from "./locales";
import type { Params } from "./translate";

export interface I18n {
  locale: Locale;
  /** Switches the language now and remembers the choice. Anything that is not a supported Locale is ignored. */
  setLocale(next: Locale): void;
  /** Translates a key into the current locale. */
  t(key: MessageKey, params?: Params): string;
}

export const I18nContext = createContext<I18n | null>(null);
