import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { explanationSource } from "./explanationSource";

describe("explanationSource", () => {
  it("maps the two sources to distinct icons and label keys", () => {
    const llm = explanationSource("llm");
    const template = explanationSource("template");
    expect(llm.icon).not.toBe(template.icon);
    expect(llm.labelKey).toBe("dayplan.summary.source.llm");
    expect(template.labelKey).toBe("dayplan.summary.source.template");
  });

  it.each([
    ["en-US", enUS],
    ["pt-BR", ptBR],
  ] as const)("has a non-empty label for each source in %s", (_locale, catalog) => {
    for (const source of ["llm", "template"] as const) {
      const value = catalog[explanationSource(source).labelKey];
      expect(typeof value === "string" && value.trim().length > 0).toBe(true);
    }
  });
});
