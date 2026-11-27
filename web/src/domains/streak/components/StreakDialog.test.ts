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

const WEEK: Streak["week"] = ["grew", "grew", "grew", "paused", "grew", "grew", "open"].map((state, i) => ({
  date: `2030-01-${String(9 + i).padStart(2, "0")}`,
  state: state as "grew" | "paused" | "broken" | "open",
}));

const COPY = {
  "pt-BR": {
    empty: "Conclua uma tarefa para começar uma",
    today: "Hoje conta",
    next: (n: number) => `Conclua uma tarefa hoje e vai para ${n}.`,
    value3: "3 dias",
    value1: "1 dia",
    value0: "0 dias",
    group: "Últimos 7 dias: 5 com conclusão, hoje ainda aberto",
    days: ["qua", "qui", "sex", "sáb", "dom", "seg", "hoje"],
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
    next: (n: number) => `Finish a Task today to reach ${n}.`,
    value3: "3 days",
    value1: "1 day",
    value0: "0 days",
    group: "Last 7 days: 5 with a Completion, today still open",
    days: ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "today"],
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

  it("at 0 shows the zero and the empty line, never Today counts or the way to 1", () => {
    for (const todayGrew of [false, true]) {
      const html = render({ current: 0, todayGrew }, locale);
      expect(html).toContain(`>${c.value0}</span>`);
      expect(html).toContain(c.empty);
      expect(html).not.toContain(c.today);
      expect(html).not.toContain(c.next(1));
    }
  });

  it("at N says the way to N + 1 until today grew it, then Today counts", () => {
    const open = render({ current: 3, todayGrew: false }, locale);
    expect(open).toContain(`>${c.value3}</span>`);
    expect(open).toContain(c.next(4));
    expect(open).not.toContain(c.today);
    const grew = render({ current: 3, todayGrew: true }, locale);
    expect(grew).toContain(`>${c.today}</span>`);
    expect(grew).not.toContain(c.next(4));
  });

  it("shows the singular at 1", () => {
    expect(render({ current: 1, todayGrew: false }, locale)).toContain(`>${c.value1}</span>`);
  });

  it("draws the week as seven badges in a group that sums it up, today last", () => {
    const html = render({ current: 6, todayGrew: false, week: WEEK }, locale);
    expect(html).toContain(`role="group" aria-label="${c.group}"`);
    const badges = [...html.matchAll(/<span class="inline-flex h-6[^>]*>(?:<svg.*?<\/svg>)?([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(badges).toEqual(c.days);
  });

  it("draws no strip without a week", () => {
    expect(render({ current: 6, todayGrew: false }, locale)).not.toContain('role="group"');
  });

  it("lists the four rules in order as a real list", () => {
    const html = render({ current: 3, todayGrew: false }, locale);
    expect(html).toMatch(/<ul /);
    expect(html.match(/<li[ >]/g)).toHaveLength(4);
    const positions = c.rules.map((rule) => html.indexOf(rule));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it.each([0, 3, 100])("is calm at %i: no role, live region or alarm colour on the number", (current) => {
    const html = render({ current, todayGrew: true }, locale);
    expect(html).not.toMatch(/role=|aria-live|danger|!/);
  });
});
