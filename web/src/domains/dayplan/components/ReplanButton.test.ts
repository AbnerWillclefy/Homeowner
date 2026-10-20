import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { I18nContext } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate } from "../../../shared/i18n/translate";
import type { ReplanState } from "../logic/replan";
import { ReplanButton } from "./ReplanButton";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR });

function render(state: ReplanState, locale: Locale = "en-US"): string {
  const i18n = { locale, setLocale: () => {}, t: (key: string, params?: never) => translate(locale, key, params) };
  return renderToStaticMarkup(
    createElement(
      I18nContext.Provider,
      { value: i18n as never },
      createElement(ReplanButton, { state, onPress: () => {} }),
    ),
  );
}

// The class list has "disabled:" variants, so look for the attribute itself.
const DISABLED = /<button[^>]*\sdisabled=""/;
const IDLE: ReplanState = { kind: "idle" };
const WAITING: ReplanState = { kind: "waiting", before: "run-1", startedAt: 0 };

describe("ReplanButton", () => {
  it.each([
    ["en-US", "Replan now"],
    ["pt-BR", "Replanejar agora"],
  ] as const)("shows an enabled button in %s when idle", (locale, label) => {
    const html = render(IDLE, locale);
    expect(html).toContain(label);
    expect(html).not.toMatch(DISABLED);
    expect(html).toContain('role="status"');
  });

  it.each([
    ["sending", { kind: "sending", before: "", startedAt: 0 }],
    ["waiting", WAITING],
  ] as const)("disables the button and says it is replanning while %s", (_name, state) => {
    const html = render(state);
    expect(html).toMatch(DISABLED);
    expect(html).toMatch(/<p role="status"[^>]*>Replanning\./);
  });

  it("re-enables the button and says in plain words that the AI made the plan", () => {
    const html = render({ kind: "done", allocator: "llm" });
    expect(html).not.toMatch(DISABLED);
    expect(html).toContain("The AI made this plan.");
  });

  it.each([
    ["en-US", "This is the baseline plan, not the AI&#x27;s: the daily AI limit was reached."],
    ["pt-BR", "Este é o plano padrão, não o da IA: o limite diário da IA foi atingido."],
  ] as const)("says why the baseline plan is shown, in %s, with no alarm and no action", (locale, text) => {
    const html = render({ kind: "done", allocator: "baseline", fallbackReason: "llm_daily_cap_reached" }, locale);
    expect(html).toContain(text);
    expect(html).not.toContain("text-danger");
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it("says calmly that the plan may still arrive after a timeout, with the button usable", () => {
    const html = render({ kind: "timedOut" });
    expect(html).toContain("It may still arrive");
    expect(html).not.toMatch(DISABLED);
    expect(html).not.toContain("text-danger");
  });

  it.each([
    ["en-US", "error", "Something went wrong and that did not go through."],
    ["pt-BR", "offline", "Parece que você está sem internet"],
  ] as const)("shows a failure as an alert in %s and keeps the button usable", (locale, failure, text) => {
    const html = render({ kind: "failed", failure }, locale);
    expect(html).toContain('role="alert"');
    expect(html).toContain(text);
    expect(html).not.toMatch(DISABLED);
  });
});
