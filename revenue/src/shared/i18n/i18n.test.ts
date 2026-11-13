import { describe, expect, it } from "vitest";
import { en, ptBR } from "./catalogs";
import { LOCALE_STORAGE_KEY, readStoredLocale, resolveLocale, translate, writeStoredLocale } from "./i18n";

describe("i18n", () => {
  it("has the same keys in both languages, none empty", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort());
    for (const text of [...Object.values(en), ...Object.values(ptBR)]) expect(text).not.toBe("");
  });

  it("defaults to pt-BR, and follows a stored choice before the browser", () => {
    expect(resolveLocale(null, [])).toBe("pt-BR");
    expect(resolveLocale(null, ["fr-FR"])).toBe("pt-BR");
    expect(resolveLocale(null, ["en-GB"])).toBe("en");
    expect(resolveLocale("pt-BR", ["en-US"])).toBe("pt-BR");
    expect(resolveLocale("en", ["pt-BR"])).toBe("en");
    expect(resolveLocale("xx", ["pt-BR"])).toBe("pt-BR");
  });

  it("fills {params}", () => {
    expect(translate("en", "forgot.rule.length", { count: 10 })).toBe("at least 10 characters");
    expect(translate("pt-BR", "nav.bills")).toBe("Contas a pagar");
  });

  it("stores the choice under revenue.locale", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    writeStoredLocale("en", storage);
    expect(LOCALE_STORAGE_KEY).toBe("revenue.locale");
    expect(readStoredLocale(storage)).toBe("en");
  });
});
