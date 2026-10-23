import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { I18nContext, type Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { Streak } from "../api/api";
import { StreakDialog } from "./StreakDialog";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);

function render(streak: Streak, locale: Locale): string {
  const t: Translate = (key, params) => translate(locale, key, params);
  return renderToStaticMarkup(
    createElement(I18nContext.Provider, { value: { locale, setLocale: () => {}, t } }, createElement(StreakDialog, { streak })),
  );
}

const COPY = {
  "pt-BR": {
    empty: "Conclua uma tarefa para começar uma",
    today: "Hoje conta",
    label3: "dias de sequência",
    label1: "dia de sequência",
    label0: "dias de sequência",
    rules: [
      "Concluir uma tarefa no dia aumenta a sequência.",
      "Um dia sem tarefas assumidas, ou esgotado, pausa a sequência.",
      "Assumir tarefas e não concluir nenhuma quebra a sequência.",
      "Recusar ou ignorar uma tarefa proposta nunca quebra a sequência.",
    ],
  },
  "en-US": {
    empty: "Finish a Task to start one",
    today: "Today counts",
    label3: "day Streak",
    label1: "day Streak",
    label0: "day Streak",
    rules: [
      "Finishing one Task in a day grows it.",
      "A day with nothing taken on, or a Drained day, pauses it.",
      "Taking on Tasks and finishing none breaks it.",
      "Refusing or ignoring a proposed Task never breaks it.",
    ],
  },
} as const;

describe.each(["pt-BR", "en-US"] as const)("StreakDialog in %s", (locale) => {
  const c = COPY[locale];

  it("at 0 shows the zero, the empty line and no Today counts", () => {
    const html = render({ current: 0, todayGrew: false }, locale);
    expect(html).toContain(">0</span>");
    expect(html).toContain(c.label0);
    expect(html).toContain(c.empty);
    expect(html).not.toContain(c.today);
  });

  it("at 0 never shows Today counts, even if todayGrew is set", () => {
    const html = render({ current: 0, todayGrew: true }, locale);
    expect(html).toContain(c.empty);
    expect(html).not.toContain(c.today);
  });

  it("at N shows the number and the plural label, and no Today counts or empty line", () => {
    const html = render({ current: 3, todayGrew: false }, locale);
    expect(html).toContain(">3</span>");
    expect(html).toContain(c.label3);
    expect(html).not.toContain(c.today);
    expect(html).not.toContain(c.empty);
  });

  it("at N with todayGrew shows Today counts", () => {
    const html = render({ current: 3, todayGrew: true }, locale);
    expect(html).toContain(`>${c.today}</p>`);
  });

  it("shows the singular label at 1 and all three digits at 100", () => {
    expect(render({ current: 1, todayGrew: false }, locale)).toContain(c.label1);
    expect(render({ current: 100, todayGrew: false }, locale)).toContain(">100</span>");
  });

  it("lists the four rules in order as a real list", () => {
    const html = render({ current: 3, todayGrew: false }, locale);
    expect(html).toMatch(/<ul /);
    expect(html.match(/<li[ >]/g)).toHaveLength(4);
    const positions = c.rules.map((rule) => html.indexOf(rule));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it.each([0, 3, 100])("is calm at %i: no role, live region, alarm colour or exclamation mark", (current) => {
    const html = render({ current, todayGrew: true }, locale);
    expect(html).not.toMatch(/role=|aria-live|danger|accent|warning|!/);
  });
});
