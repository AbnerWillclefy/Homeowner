import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { I18nContext, type Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { Explanation } from "../api/api";
import type { SummaryCounts } from "../logic/summaryCounts";
import { DaySummary } from "./DaySummary";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);

const EXPLANATION: Explanation = {
  source: "llm",
  headline: { "en-US": "A light day for you", "pt-BR": "Um dia leve para você" },
  detail: { "en-US": "Two small Tasks, and the rest can wait.", "pt-BR": "Duas tarefas pequenas, o resto pode esperar." },
};
const DRAINED: Explanation = {
  source: "template",
  headline: { "en-US": "Today is for resting", "pt-BR": "Hoje é dia de descansar" },
  detail: { "en-US": "Rest is the plan today.", "pt-BR": "Descansar é o plano de hoje." },
};
const ALL: SummaryCounts = { mine: 2, others: 3, pool: 4 };
const NONE: SummaryCounts = { mine: 0, others: 0, pool: 0 };

function render(explanation: Explanation | null | undefined, counts: SummaryCounts, locale: Locale): string {
  const t: Translate = (key, params) => translate(locale, key, params);
  const i18n = { locale, setLocale: () => {}, t };
  return renderToStaticMarkup(
    createElement(I18nContext.Provider, { value: i18n }, createElement(DaySummary, { explanation, counts })),
  );
}

describe("DaySummary", () => {
  it.each([
    ["en-US", "A light day for you", "Two small Tasks, and the rest can wait."],
    ["pt-BR", "Um dia leve para você", "Duas tarefas pequenas, o resto pode esperar."],
  ] as const)("shows the server headline and detail in %s, the headline labelling the section", (locale, headline, detail) => {
    const html = render(EXPLANATION, ALL, locale);
    const id = /<h3 id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toMatch(/^<section /);
    expect(html).toContain(`aria-labelledby="${id}"`);
    expect(html).toContain(`>${headline}</h3>`);
    expect(html).toContain(`>${detail}</p>`);
    expect(html.indexOf("</h3>")).toBeLessThan(html.indexOf("<p "));
    expect(html.indexOf("</p>")).toBeLessThan(html.indexOf("<ul"));
  });

  it("does not show the other language", () => {
    expect(render(EXPLANATION, ALL, "pt-BR")).not.toContain("A light day");
  });

  it.each([
    ["en-US", ["2 Tasks for you", "3 for others", "4 still to do"]],
    ["pt-BR", ["2 tarefas suas", "3 dos outros", "4 por fazer"]],
  ] as const)("lists the counts as a real list with words in %s", (locale, texts) => {
    const html = render(EXPLANATION, ALL, locale);
    expect(html.match(/<li /g)).toHaveLength(3);
    for (const text of texts) expect(html).toContain(`>${text}</span>`);
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(3);
  });

  it.each([
    ["en-US", "1 Task for you"],
    ["pt-BR", "1 tarefa sua"],
  ] as const)("uses the singular for one in %s", (locale, text) => {
    expect(render(EXPLANATION, { mine: 1, others: 0, pool: 0 }, locale)).toContain(`>${text}</span>`);
  });

  it("hides each count that is zero", () => {
    const html = render(EXPLANATION, { mine: 0, others: 2, pool: 0 }, "en-US");
    expect(html.match(/<li /g)).toHaveLength(1);
    expect(html).toContain("2 for others");
    expect(html).not.toContain("Tasks for you");
    expect(html).not.toContain("still to do");
  });

  it("renders no list at all when every count is zero", () => {
    const html = render(EXPLANATION, NONE, "pt-BR");
    expect(html).not.toMatch(/<ul|<li/);
    expect(html).toContain("Um dia leve para você");
  });

  it.each([null, undefined])("renders nothing for %s", (explanation) => {
    expect(render(explanation, ALL, "en-US")).toBe("");
  });

  it.each(["en-US", "pt-BR"] as const)(
    "keeps a Drained day neutral in %s: no alert, live region, warning colour or exclamation mark",
    (locale) => {
      const html = render(DRAINED, { mine: 0, others: 1, pool: 2 }, locale);
      expect(html).not.toMatch(/role=|aria-live|danger|warning|error|alert|!/i);
      expect(html).toContain(DRAINED.headline[locale]);
    },
  );
});
