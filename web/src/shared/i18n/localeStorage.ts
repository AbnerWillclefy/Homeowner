// The storage seam for the Resident's language choice. No React, no catalogs.
//
// The value is exactly a Locale tag ("en-US" or "pt-BR"): not JSON, not a wrapper.
// The backend follow-up (users.locale) reuses the same two tags. Reading does not
// validate: resolveLocale does, through isLocale, which stays the single validator.
// Every failure is silent: a blocked, full or absent storage means the choice
// applies to this session only, and the browser language decides next time.
import type { Locale } from "./locales";

export const LOCALE_STORAGE_KEY = "homeowner.locale";

export type LocaleStorage = Pick<Storage, "getItem" | "setItem">;

/** The raw stored value, or undefined when there is none or storage is unusable. */
export function readStoredLocale(storage?: LocaleStorage): unknown {
  try {
    const target = storage ?? globalThis.localStorage;
    return target.getItem(LOCALE_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Remembers an explicit choice. Never throws. */
export function writeStoredLocale(locale: Locale, storage?: LocaleStorage): void {
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}
