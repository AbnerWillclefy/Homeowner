import { en, ptBR, type MessageKey } from "./catalogs";

export const LOCALES = ["pt-BR", "en"] as const;
export type Locale = (typeof LOCALES)[number];
/** pt-BR first: most Residents use Brazilian Portuguese. */
export const DEFAULT_LOCALE: Locale = "pt-BR";
export const LOCALE_STORAGE_KEY = "revenue.locale";

export type Params = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: Params) => string;

const catalogs: Record<Locale, Record<MessageKey, string>> = { "pt-BR": ptBR, en };

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** The User's stored choice wins; otherwise English only when the browser prefers it, else pt-BR. */
export function resolveLocale(stored: unknown, languages: readonly string[]): Locale {
  if (isLocale(stored)) return stored;
  const first = languages[0]?.toLowerCase();
  return first?.startsWith("en") ? "en" : DEFAULT_LOCALE;
}

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const text = catalogs[locale][key];
  return params ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (Object.hasOwn(params, name) ? String(params[name]) : whole)) : text;
}

export function readStoredLocale(storage: Pick<Storage, "getItem"> = globalThis.localStorage): string | null {
  try {
    return storage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: Locale, storage: Pick<Storage, "setItem"> = globalThis.localStorage): void {
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}
