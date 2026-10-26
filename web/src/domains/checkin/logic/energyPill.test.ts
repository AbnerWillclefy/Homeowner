import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import type { Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { Level } from "../api/api";
import type { EnergyNote } from "./state";
import { energyPill, pillWidthTexts, type PillInput } from "./energyPill";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const tFor = (locale: Locale): Translate => (key, params) => translate(locale, key, params);
const view = (locale: Locale, input: PillInput) => energyPill(tFor(locale), input, (n) => String(n));

const ready = (note: EnergyNote, energy: number | null, level: Level | null = null): PillInput => ({
  kind: "ready",
  note,
  energy,
  level,
});

describe("energyPill", () => {
  it.each([
    ["pt-BR", ready("unset", null), "Check-in", "Fazer check-in", true, "none"],
    ["en-US", ready("unset", null), "Check-in", "Check in", true, "none"],
    ["pt-BR", ready("energy", 5), "5", "Energia hoje: 5. Mudar check-in", false, "zap"],
    ["en-US", ready("energy", 5), "5", "Energy today: 5. Change Check-in", false, "zap"],
    ["pt-BR", ready("drained", 0), "0", "Esgotado hoje. Mudar check-in", false, "moon"],
    ["en-US", ready("drained", 0), "0", "Drained today. Change Check-in", false, "moon"],
    ["pt-BR", ready("no-baseline", 0), "0", "Sem energia base hoje. Mudar check-in", false, "zap"],
    ["en-US", ready("no-baseline", 0), "0", "No Baseline today. Change Check-in", false, "zap"],
    ["pt-BR", ready("pending", null, "low"), "Baixa", "Check-in feito: Baixa. Mudar check-in", false, "check"],
    ["en-US", ready("pending", null, "low"), "Low", "Checked in: Low. Change Check-in", false, "check"],
    ["pt-BR", { kind: "failed" }, "Falhou", "Energia indisponível. Tentar de novo", false, "alert"],
    ["en-US", { kind: "failed" }, "Failed", "Energy unavailable. Try again", false, "alert"],
  ] as const)("in %s %j reads %s, is named %s, dashed %s, icon %s", (locale, input, text, name, dashed, icon) => {
    expect(view(locale, input)).toMatchObject({ text, name, dashed, icon });
  });

  it("dashes only the unset state, and every state has its own accessible name", () => {
    const inputs: PillInput[] = [
      ready("unset", null),
      ready("energy", 5),
      ready("drained", 0),
      ready("no-baseline", 0),
      ready("pending", null, "low"),
      { kind: "failed" },
    ];
    const views = inputs.map((input) => view("en-US", input));
    expect(views.filter((v) => v.dashed)).toHaveLength(1);
    expect(new Set(views.map((v) => v.name)).size).toBe(views.length);
  });

  it("falls back to the Check-in word when a checked-in Resident has no level", () => {
    expect(view("en-US", ready("pending", null))).toMatchObject({ text: "Check-in", name: "Checked in. Change Check-in" });
  });

  it("is empty while loading", () => {
    expect(view("en-US", { kind: "loading" })).toMatchObject({ kind: "loading", text: "", name: "" });
  });

  it("formats the number with the given formatter", () => {
    expect(energyPill(tFor("pt-BR"), ready("energy", 1234), (n) => `#${n}`).text).toBe("#1234");
  });
});

describe("pillWidthTexts", () => {
  it("lists every text the pill can show, so the box is as wide as the widest", () => {
    const texts = pillWidthTexts(tFor("pt-BR"), "5");
    expect(texts).toEqual(expect.arrayContaining(["Check-in", "5", "Falhou", "Baixa", "Normal", "Energizado"]));
  });
});
