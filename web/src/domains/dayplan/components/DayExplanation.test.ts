import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nContext } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import type { Explanation } from "../api/api";
import { DayExplanation } from "./DayExplanation";

const TEXT = { "en-US": "A light day for you.", "pt-BR": "Um dia leve para você." };

function render(explanation: Explanation | null | undefined, locale: Locale): string {
  const i18n = { locale, setLocale: () => {}, t: (key: string) => key };
  return renderToStaticMarkup(
    createElement(I18nContext.Provider, { value: i18n as never }, createElement(DayExplanation, { explanation })),
  );
}

describe("DayExplanation", () => {
  it.each([
    ["llm", "en-US", "A light day for you."],
    ["llm", "pt-BR", "Um dia leve para você."],
    ["template", "en-US", "A light day for you."],
    ["template", "pt-BR", "Um dia leve para você."],
  ] as const)("shows the %s text in %s as one plain paragraph", (source, locale, text) => {
    expect(render({ source, text: TEXT }, locale)).toBe(`<p class="mt-0 mb-6 text-muted">${text}</p>`);
  });

  it("is read in order and never announced: no live region, no role, no tabindex", () => {
    const html = render({ source: "llm", text: TEXT }, "en-US");
    expect(html).not.toMatch(/role=|aria-live|aria-atomic|tabindex/i);
  });

  it.each([null, undefined])("renders nothing for %s", (explanation) => {
    expect(render(explanation, "en-US")).toBe("");
  });

  it("renders nothing for an empty text rather than an empty paragraph", () => {
    expect(render({ source: "template", text: { "en-US": " ", "pt-BR": "" } }, "pt-BR")).toBe("");
  });
});
