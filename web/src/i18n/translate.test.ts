import { describe, expect, it } from "vitest";
import type { Locale } from "./locales";
import { createTranslate, type Catalogs } from "./translate";

const fixtures = {
  "en-US": {
    greeting: "Hello, {name}.",
    twice: "{name} and {name}",
    total: "Total: {amount}",
    tasks: { one: "{count} task", other: "{count} tasks" },
    onlyEnglish: "Only in English",
    blankInPt: "Blank in Portuguese",
  },
  "pt-BR": {
    greeting: "Olá, {name}.",
    twice: "{name} e {name}",
    total: "Total: {amount}",
    tasks: { one: "{count} tarefa", other: "{count} tarefas" },
    blankInPt: "",
  },
} as unknown as Catalogs;

const t = createTranslate(fixtures);

describe("placeholder substitution", () => {
  it("replaces a placeholder", () => {
    expect(t("en-US", "greeting", { name: "Ana" })).toBe("Hello, Ana.");
    expect(t("pt-BR", "greeting", { name: "Ana" })).toBe("Olá, Ana.");
  });

  it("replaces a repeated placeholder", () => {
    expect(t("en-US", "twice", { name: "Ana" })).toBe("Ana and Ana");
  });

  it("leaves a placeholder without a param as written", () => {
    expect(t("en-US", "greeting")).toBe("Hello, {name}.");
    expect(t("en-US", "greeting", {})).toBe("Hello, {name}.");
  });

  it("formats numbers for the locale", () => {
    expect(t("en-US", "total", { amount: 1234.5 })).toBe("Total: 1,234.5");
    expect(t("pt-BR", "total", { amount: 1234.5 })).toBe("Total: 1.234,5");
  });
});

describe("plural choice", () => {
  it.each<[Locale, number, string]>([
    ["en-US", 0, "0 tasks"],
    ["en-US", 1, "1 task"],
    ["en-US", 2, "2 tasks"],
    ["pt-BR", 0, "0 tarefa"],
    ["pt-BR", 1, "1 tarefa"],
    ["pt-BR", 2, "2 tarefas"],
  ])("%s with count %d gives %j", (locale, count, expected) => {
    expect(t(locale, "tasks", { count })).toBe(expected);
  });

  it("falls back to the other form when count is not a finite number", () => {
    expect(t("en-US", "tasks", { count: Number.NaN })).toBe("NaN tasks");
    expect(t("en-US", "tasks", { count: "1" })).toBe("1 tasks");
    expect(t("en-US", "tasks")).toBe("{count} tasks");
  });

  it("falls back to other when the chosen form is absent", () => {
    const only = createTranslate({
      "en-US": { n: { one: "uno", other: "otros" } },
      "pt-BR": { n: { one: "um", other: "outros" } },
    } as unknown as Catalogs);
    // 1,000,000 is the "many" category in pt-BR; no many form is defined.
    expect(only("pt-BR", "n", { count: 1_000_000 })).toBe("outros");
  });
});

describe("fallback to en-US", () => {
  it("uses the English text when the key is missing in pt-BR", () => {
    expect(t("pt-BR", "onlyEnglish")).toBe("Only in English");
  });

  it("uses the English text when the pt-BR value is empty", () => {
    expect(t("pt-BR", "blankInPt")).toBe("Blank in Portuguese");
  });

  it("returns the key when even en-US lacks it", () => {
    expect(t("en-US", "nope")).toBe("nope");
  });
});
