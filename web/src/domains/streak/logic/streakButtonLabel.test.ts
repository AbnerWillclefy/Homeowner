import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import type { Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import { streakButtonLabel } from "./streakButtonLabel";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const label = (locale: Locale, current: number, paused = false) => {
  const t: Translate = (key, params) => translate(locale, key, params);
  return streakButtonLabel(t, current, paused);
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

  it.each([
    ["pt-BR", 1, "Sequência pausada: 1 dia"],
    ["pt-BR", 6, "Sequência pausada: 6 dias"],
    ["en-US", 1, "Streak paused: 1 day"],
    ["en-US", 6, "Streak paused: 6 days"],
    // Nothing to pause at 0.
    ["pt-BR", 0, "Sequência: 0 dias"],
  ] as const)("on a Drained day in %s a Streak of %i reads %s", (locale, current, expected) => {
    expect(label(locale, current, true)).toBe(expected);
  });
});
