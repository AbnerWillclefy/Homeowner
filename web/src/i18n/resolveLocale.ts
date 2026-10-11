import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

const BY_PRIMARY_SUBTAG: Record<string, Locale> = {
  pt: "pt-BR",
  en: "en-US",
};

function fromTag(tag: unknown): Locale | undefined {
  if (typeof tag !== "string" || tag === "") return undefined;
  const primary = tag.split(/[-_]/, 1)[0]!.toLowerCase();
  return Object.hasOwn(BY_PRIMARY_SUBTAG, primary) ? BY_PRIMARY_SUBTAG[primary] : undefined;
}

export interface ResolveInput {
  /** Usually navigator.languages. */
  languages?: readonly string[] | null;
  /** The Resident's saved choice, if any. An invalid value is ignored. */
  stored?: unknown;
}

/** Picks the language to show. Pure, and never throws. */
export function resolveLocale({ languages, stored }: ResolveInput): Locale {
  if (isLocale(stored)) return stored;
  if (Array.isArray(languages)) {
    for (const tag of languages) {
      const found = fromTag(tag);
      if (found) return found;
    }
  }
  return DEFAULT_LOCALE;
}
