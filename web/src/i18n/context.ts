import { createContext } from "react";
import type { MessageKey } from "./catalogs/en-US";
import type { Locale } from "./locales";
import type { Params } from "./translate";

export interface I18n {
  locale: Locale;
  /** Translates a key into the current locale. */
  t(key: MessageKey, params?: Params): string;
}

export const I18nContext = createContext<I18n | null>(null);
