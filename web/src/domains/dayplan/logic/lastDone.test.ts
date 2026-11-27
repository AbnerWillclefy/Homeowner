import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import { lastDoneText } from "./lastDone";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const text = (locale: "pt-BR" | "en-US", date: string, names: string[]) => lastDoneText((k, p) => translate(locale, k, p), locale, "2030-03-01", date, names);

describe("lastDoneText", () => {
  it.each([
    ["pt-BR", "2030-03-01", ["Ana"], "Hoje, Ana"],
    ["pt-BR", "2030-02-28", ["Ana"], "Ontem, Ana"],
    ["en-US", "2030-02-28", ["Ana"], "Yesterday, Ana"],
    ["en-US", "2030-02-20", ["Ana", "Bia"], "Feb 20, Ana, Bia"],
    ["pt-BR", "2030-02-28", [], "Ontem"],
  ] as const)("%s %s %j is %s", (locale, date, names, expected) => {
    expect(text(locale, date, [...names])).toBe(expected);
  });

  it("finds yesterday across a month change", () => {
    expect(lastDoneText((k, p) => translate("en-US", k, p), "en-US", "2030-03-01", "2030-02-28", [])).toBe("Yesterday");
    expect(lastDoneText((k, p) => translate("en-US", k, p), "en-US", "2028-03-01", "2028-02-29", [])).toBe("Yesterday");
  });
});
