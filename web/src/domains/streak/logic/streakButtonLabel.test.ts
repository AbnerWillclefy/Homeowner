import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import type { Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import { streakButtonLabel } from "./streakButtonLabel";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const label = (locale: Locale, current: number) => {
  const t: Translate = (key, params) => translate(locale, key, params);
  return streakButtonLabel(t, current);
};

describe("streakButtonLabel", () => {
  it.each([
    ["pt-BR", 0, "Sequência: 0 dias"],
    ["pt-BR", 1, "Sequência: 1 dia"],
    ["pt-BR", 3, "Sequência: 3 dias"],
    ["pt-BR", 1000, "Sequência: 1.000 dias"],
    ["en-US", 0, "Streak: 0 days"],
    ["en-US", 1, "Streak: 1 day"],
    ["en-US", 3, "Streak: 3 days"],
    ["en-US", 100, "Streak: 100 days"],
  ] as const)("in %s a Streak of %i reads %s", (locale, current, expected) => {
    expect(label(locale, current)).toBe(expected);
  });
});
