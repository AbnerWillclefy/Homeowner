import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { I18nContext, type Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { CompletedTask } from "../api/api";
import { DoneCard } from "./DoneCard";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);

const DONE: CompletedTask = {
  id: "t9",
  choreName: "Take out trash",
  completedAt: "2026-10-11T14:30:00Z",
  category: "kitchen",
  with: [],
};

function render(done: CompletedTask, locale: Locale): string {
  const t: Translate = (key, params) => translate(locale, key, params);
  const i18n = { locale, setLocale: () => {}, t };
  return renderToStaticMarkup(createElement(I18nContext.Provider, { value: i18n }, createElement(DoneCard, { done })));
}

/** The visible text of the card's time line. */
const timeLine = (html: string) => />((?:Done at|Concluída às) [^<]*)</.exec(html)?.[1];

describe("DoneCard", () => {
  it.each([
    ["en-US", /^Done at \d{1,2}:\d{2}\s?(AM|PM)$/],
    ["pt-BR", /^Concluída às \d{1,2}:\d{2}$/],
  ] as const)("says only when a one-person Task was done in %s", (locale, line) => {
    expect(timeLine(render(DONE, locale))).toMatch(line);
  });

  it.each([
    ["en-US", /^Done at .*, together$/],
    ["pt-BR", /^Concluída às .*, em dupla$/],
  ] as const)("adds who it was done with for a two-person Task in %s", (locale, line) => {
    expect(timeLine(render({ ...DONE, with: ["r2"] }, locale))).toMatch(line);
  });

  it("shows the Category name above the Chore and no facts, effort or buttons", () => {
    const html = render(DONE, "en-US");
    expect(html).toMatch(/^<li /);
    expect(html.indexOf("Kitchen")).toBeGreaterThan(-1);
    expect(html.indexOf("Kitchen")).toBeLessThan(html.indexOf("Take out trash"));
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("Effort");
  });

  it("is neutral, never tinted with the Category pastel", () => {
    expect(render(DONE, "en-US")).toContain("bg-surface-raised");
  });

  it("marks its icons decorative", () => {
    const html = render(DONE, "en-US");
    expect(html.match(/<svg/g)).toHaveLength(html.match(/<svg[^>]*aria-hidden="true"/g)?.length ?? -1);
  });

  it("shows an unknown or missing Category as Other", () => {
    expect(render({ ...DONE, category: "nonsense" }, "en-US")).toContain("Other");
    const { category: _unused, ...without } = DONE;
    expect(render(without, "pt-BR")).toContain("Outros");
  });
});
