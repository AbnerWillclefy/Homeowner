import type { Locale } from "./locales";

/** A plain sentence, or a plural with one sentence per form. */
export type Message = string | { one: string; other: string; many?: string };

export type Catalogs = Record<Locale, Record<string, Message | undefined>>;

export type Params = Readonly<Record<string, string | number>>;

const numberFormats = new Map<Locale, Intl.NumberFormat>();
const pluralRules = new Map<Locale, Intl.PluralRules>();

function numberFormat(locale: Locale): Intl.NumberFormat {
  let format = numberFormats.get(locale);
  if (!format) numberFormats.set(locale, (format = new Intl.NumberFormat(locale)));
  return format;
}

function rules(locale: Locale): Intl.PluralRules {
  let found = pluralRules.get(locale);
  if (!found) pluralRules.set(locale, (found = new Intl.PluralRules(locale)));
  return found;
}

function isPresent(message: Message | undefined): message is Message {
  return message !== undefined && message !== "";
}

function pickText(locale: Locale, message: Message, params: Params | undefined): string {
  if (typeof message === "string") return message;
  const count = params?.count;
  if (typeof count === "number" && Number.isFinite(count)) {
    const form = rules(locale).select(count);
    if (form === "one" || form === "many") {
      const text = message[form];
      if (text) return text;
    }
  }
  return message.other;
}

function fill(locale: Locale, text: string, params: Params | undefined): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!Object.hasOwn(params, name)) return whole;
    const value = params[name]!;
    return typeof value === "number" ? numberFormat(locale).format(value) : value;
  });
}

const warned = new Set<string>();

/**
 * Builds the translate function over a set of catalogs. Lookup is the locale's
 * own catalog, then en-US, then the key itself. An empty value counts as missing.
 * Pure: no React, no DOM, no catalog imports.
 */
export function createTranslate(catalogs: Catalogs) {
  return function t(locale: Locale, key: string, params?: Params): string {
    const own = catalogs[locale][key];
    const message = isPresent(own) ? own : catalogs["en-US"][key];
    if (!isPresent(message)) {
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(`i18n: no text for key "${key}"`);
      }
      return key;
    }
    return fill(locale, pickText(locale, message, params), params);
  };
}
