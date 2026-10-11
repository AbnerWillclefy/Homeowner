// The closed set of supported languages, as BCP 47 tags. The backend reuses
// these tags (users.locale, Accept-Language). No imports and no DOM types, so
// the service worker build can include this file.
export const LOCALES = ["en-US", "pt-BR"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en-US";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
