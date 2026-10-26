import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { I18nContext, type Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { Explanation } from "../api/api";
import { dayPlan } from "../testing/fixtures";
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

function render(explanation: Explanation | null | undefined, locale: Locale): string {
  const t: Translate = (key, params) => translate(locale, key, params);
  const i18n = { locale, setLocale: () => {}, t };
  return renderToStaticMarkup(
    createElement(
      I18nContext.Provider,
      { value: i18n },
      createElement(DaySummary, { plan: dayPlan({ explanation: explanation ?? undefined }) }),
    ),
  );
}

describe("DaySummary", () => {
  it.each([
    ["en-US", "A light day for you"],
    ["pt-BR", "Um dia leve para você"],
  ] as const)("is one muted paragraph with the headline in %s, and nothing else", (locale, headline) => {
    const html = render(EXPLANATION, locale);
    expect(html.match(/<p /g)).toHaveLength(1);
    expect(html).toMatch(/^<p [^>]*text-muted[^>]*>/);
    expect(html).toContain(headline);
    expect(html).not.toMatch(/<button|<h\d|<ul|<li|aria-expanded|\shidden=/);
    expect(html).not.toContain(EXPLANATION.detail[locale]);
  });

  it("wraps long words instead of cutting them", () => {
    expect(render(EXPLANATION, "pt-BR")).toContain("[overflow-wrap:anywhere]");
    expect(render(EXPLANATION, "pt-BR")).not.toMatch(/truncate|line-clamp|text-ellipsis/);
  });

  it.each([
    ["llm", "en-US", "Written by the assistant"],
    ["llm", "pt-BR", "Escrito pelo assistente"],
    ["template", "en-US", "Standard summary of today&#x27;s reasons"],
    ["template", "pt-BR", "Resumo padrão dos motivos de hoje"],
  ] as const)("names the %s source in %s as visually hidden text next to an aria-hidden icon", (source, locale, label) => {
    const html = render({ ...EXPLANATION, source }, locale);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toMatch(new RegExp(`<span class="sr-only">${label}[^<]*</span>`));
    expect(html.indexOf(label)).toBeLessThan(html.indexOf(EXPLANATION.headline[locale]));
  });

  it("shows a different small icon for each source", () => {
    expect(render(EXPLANATION, "en-US")).toContain("lucide-sparkles");
    expect(render(DRAINED, "en-US")).toContain("lucide-scroll-text");
  });

  it("does not show the other language", () => {
    expect(render(EXPLANATION, "pt-BR")).not.toContain("A light day");
  });

  it.each([null, undefined])("renders nothing for %s", (explanation) => {
    expect(render(explanation, "en-US")).toBe("");
  });

  it.each(["en-US", "pt-BR"] as const)(
    "keeps a Drained day neutral in %s: no alert, live region, warning colour or exclamation mark",
    (locale) => {
      const html = render(DRAINED, locale);
      expect(html).not.toMatch(/role=|aria-live|danger|warning|error|alert|!/i);
      expect(html).toContain(DRAINED.headline[locale]);
      expect(html).not.toMatch(/text-accent|bg-accent/);
    },
  );
});
