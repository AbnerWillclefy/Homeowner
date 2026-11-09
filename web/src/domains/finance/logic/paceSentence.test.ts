import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import type { Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import { paceSentence } from "./paceSentence";
import type { SameDays } from "./sameDays";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const same = (spent: number, previousSpent: number, over: Partial<SameDays> = {}): SameDays => ({
  spent, previousSpent, cutDay: 8, noPrevious: false, byCategory: new Map(), ...over,
});
const say = (locale: Locale, days: SameDays, day = 8, month = "2026-11") => {
  const t: Translate = (key, params) => translate(locale, key, params);
  return paceSentence(t, locale, days, day, month);
};
// Intl puts a no-break space between R$ and the number.
const flat = (text: string | null) => text?.replace(/\s/g, " ");

describe("paceSentence", () => {
  it.each([
    ["pt-BR", same(81200, 42000), "Até dia 8 você gastou R$ 392,00 a mais que até 8 de outubro"],
    ["pt-BR", same(42000, 81200), "Até dia 8 você gastou R$ 392,00 a menos que até 8 de outubro"],
    ["pt-BR", same(42000, 42000), "Até dia 8 você gastou o mesmo que até 8 de outubro"],
    ["en-US", same(81200, 42000), "Up to day 8 you spent R$392.00 more than up to October 8"],
    ["en-US", same(42000, 81200), "Up to day 8 you spent R$392.00 less than up to October 8"],
    ["en-US", same(42000, 42000), "Up to day 8 you spent the same as up to October 8"],
  ] as const)("in %s reads the gap", (locale, days, expected) => {
    expect(flat(say(locale, days))).toBe(expected);
  });

  it("names the clamped cut day, so 31 October reads 30 September", () => {
    const sentence = flat(say("pt-BR", same(100, 50, { cutDay: 30 }), 31, "2026-10"));
    expect(sentence).toContain("Até dia 31");
    expect(sentence).toContain("até 30 de setembro");
  });

  it.each([
    // This month is 812,00 up to the 8th; the average there is the second number.
    ["pt-BR", 42000, 3, "e R$ 392,00 a mais que a média de 3 meses"],
    ["pt-BR", 120400, 1, "e R$ 392,00 a menos que a média de 1 mês"],
    ["pt-BR", 81200, 2, "e o mesmo que a média de 2 meses"],
    ["en-US", 42000, 3, "and R$392.00 more than your 3-month average"],
    ["en-US", 120400, 1, "and R$392.00 less than your 1-month average"],
    ["en-US", 81200, 2, "and the same as your 2-month average"],
  ] as const)("in %s adds the average clause for an average of %s over %s months", (locale, cents, months, clause) => {
    const t: Translate = (key, params) => translate(locale, key, params);
    expect(flat(paceSentence(t, locale, same(81200, 42000), 8, "2026-11", { cents, months }))).toContain(clause);
  });

  it("leaves the average out when there is none", () => {
    expect(flat(say("pt-BR", same(81200, 42000)))).not.toContain("média");
  });

  it("says there is nothing to compare with when last month has no Transactions", () => {
    expect(say("pt-BR", same(100, 0, { noPrevious: true }))).toBe("Sem lançamentos em outubro para comparar.");
  });
});
