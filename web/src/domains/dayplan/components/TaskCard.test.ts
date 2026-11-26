import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShellContext } from "../../../app/components/ShellContext";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { I18nContext, type Translate } from "../../../shared/i18n/context";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { Resident } from "../../residents/api/api";
import type { PlanTask } from "../api/api";
import type { TaskRole } from "../logic/actions";
import { TaskCard } from "./TaskCard";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);

const ANA = { id: "r1", you: false, name: "Ana" } as Resident;
const TASK: PlanTask = {
  id: "t1",
  choreId: "c1",
  choreName: "Wash dishes",
  windowStart: "2026-10-11",
  windowEnd: "2026-10-12",
  currentEffort: 3,
  baseEffort: 3,
  people: 1,
  importance: "normal",
  reason: "waiting_for_responsible",
  responsibleResidentId: "r1",
};

type Props = Partial<Parameters<typeof TaskCard>[0]>;

function render(task: PlanTask, locale: Locale, residents: Resident[], role: TaskRole = "pool", props: Props = {}): string {
  const t: Translate = (key, params) => translate(locale, key, params);
  const shell = { residents: { byResidentId: (id: string) => residents.find((r) => r.id === id) } };
  const all = { task, role, today: "2026-10-11", busy: false, pending: null, onAction: () => {}, ...props };
  return renderToStaticMarkup(
    createElement(
      I18nContext.Provider,
      { value: { locale, setLocale: () => {}, t } },
      createElement(ShellContext.Provider, { value: shell as never }, createElement(TaskCard, all)),
    ),
  );
}

/** The card's one-line why: the paragraph that follows the Category line, Effort and caption. */
const whyLine = (html: string) => /<span class="line-clamp-1">([^<]*)<\/span>/.exec(html)?.[1];
/** The text of every button in the card's own area (the ⋯ trigger has only a hidden label). */
const buttons = (html: string) => [...html.matchAll(/<button[^>]*?(?:aria-label="([^"]*)")?[^>]*>(.*?)<\/button>/g)].map((m) => m[0]);
const names = (html: string) => [...html.matchAll(/<button[^>]*aria-label="([^"]*)"/g)].map((m) => m[1]);

describe("TaskCard pool reason waiting_for_responsible", () => {
  it.each([
    ["pt-BR", "Aguardando Ana."],
    ["en-US", "Waiting for Ana."],
  ] as const)("names the responsible Resident in %s", (locale, line) => {
    expect(whyLine(render(TASK, locale, [ANA]))).toBe(line);
  });

  it("says you for the caller", () => {
    expect(whyLine(render(TASK, "pt-BR", [{ ...ANA, you: true }]))).toBe("Aguardando você.");
  });

  it.each([
    ["an id the list does not hold (they left)", { ...TASK, responsibleResidentId: "gone" }, [ANA]],
    ["no id after the responsibility was cleared", { ...TASK, responsibleResidentId: undefined }, [ANA]],
    ["a list that has not loaded", TASK, []],
  ] as const)("falls back to the responsible person for %s", (_why, task, residents) => {
    expect(whyLine(render(task, "pt-BR", [...residents]))).toBe("Aguardando o morador responsável.");
    expect(whyLine(render(task, "en-US", [...residents]))).toBe("Waiting for the responsible person.");
  });

  it("leaves the other pool reasons as they were", () => {
    expect(whyLine(render({ ...TASK, reason: "refused" }, "en-US", [ANA]))).toBe("It was refused, so it is back in the pool.");
  });
});

describe("TaskCard shows the Category, Chore and Effort as text", () => {
  const html = render({ ...TASK, category: "kitchen" }, "pt-BR", [ANA]);

  it("writes the Category name, the Chore and the Effort level", () => {
    expect(html).toContain("Cozinha");
    expect(html).toContain("Wash dishes");
    expect(html).toContain("Esforço: Médio");
  });

  it("never writes a raw Category id, an unknown one reads as Other", () => {
    const unknown = render({ ...TASK, category: "garage" }, "pt-BR", [ANA]);
    expect(unknown).not.toContain("garage");
    expect(unknown).toContain("Outros");
  });
});

describe("TaskCard buttons per role", () => {
  const mine = { ...TASK, reason: "fits_energy" };

  it("gives a Proposed Task Recusar then Aceitar, each named after the Task", () => {
    expect(names(render(mine, "pt-BR", [], "mine"))).toEqual(["Recusar Wash dishes", "Aceitar Wash dishes"]);
  });

  it("gives a Committed Task Concluir alone and the Assumida badge", () => {
    const html = render({ ...mine, committed: true }, "pt-BR", [], "mine");
    expect(names(html)).toEqual(["Concluir Wash dishes"]);
    expect(html).toContain("Assumida");
    expect(buttons(html).some((b) => b.includes(">Aceitar<") || b.includes(">Recusar<"))).toBe(false);
  });

  it("gives a pool Task Pegar, with the one-step Concluir in its menu rather than as a button", () => {
    const html = render(TASK, "pt-BR", [], "pool");
    expect(names(html)).toEqual(["Pegar Wash dishes"]);
    expect(html).toContain("Mais ações, Wash dishes");
  });

  it("gives a two-person pool Task no button and no menu", () => {
    const html = render({ ...TASK, people: 2 }, "pt-BR", [], "pool");
    expect(names(html)).toEqual([]);
    expect(html).not.toContain("Mais ações");
  });

  it("gives another Resident's Task a menu only when a Swap can be offered", () => {
    expect(render(TASK, "pt-BR", [], "other")).not.toContain("Mais ações");
    expect(render(TASK, "pt-BR", [], "other", { onSwap: () => {} })).toContain("Mais ações, Wash dishes");
  });

  it("disables every button while an action runs, and spins only the one that is running", () => {
    const html = render(mine, "pt-BR", [], "mine", { busy: true, pending: "accept" });
    expect([...html.matchAll(/<button[^>]*disabled/g)]).toHaveLength(2);
    expect(html.match(/aria-busy="true"/g)).toHaveLength(1);
  });

  it("words the buttons in English too", () => {
    expect(names(render(mine, "en-US", [], "mine"))).toEqual(["Refuse Wash dishes", "Accept Wash dishes"]);
  });
});
