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

function render(task: PlanTask, locale: Locale, residents: Resident[]): string {
  const t: Translate = (key, params) => translate(locale, key, params);
  const shell = { residents: { byResidentId: (id: string) => residents.find((r) => r.id === id) } };
  const props = { task, role: "pool" as const, today: "2026-10-11", busy: false, pending: null, onAction: () => {} };
  return renderToStaticMarkup(
    createElement(
      I18nContext.Provider,
      { value: { locale, setLocale: () => {}, t } },
      createElement(ShellContext.Provider, { value: shell as never }, createElement(TaskCard, props)),
    ),
  );
}

const reasonLine = (html: string) => />((?:Why|Por quê): [^<]*)</.exec(html)?.[1];

describe("TaskCard pool reason waiting_for_responsible", () => {
  it.each([
    ["pt-BR", "Por quê: Aguardando Ana."],
    ["en-US", "Why: Waiting for Ana."],
  ] as const)("names the responsible Resident in %s", (locale, line) => {
    expect(reasonLine(render(TASK, locale, [ANA]))).toBe(line);
  });

  it("says you for the caller", () => {
    expect(reasonLine(render(TASK, "pt-BR", [{ ...ANA, you: true }]))).toBe("Por quê: Aguardando você.");
  });

  it.each([
    ["an id the list does not hold (they left)", { ...TASK, responsibleResidentId: "gone" }, [ANA]],
    ["no id after the responsibility was cleared", { ...TASK, responsibleResidentId: undefined }, [ANA]],
    ["a list that has not loaded", TASK, []],
  ] as const)("falls back to the responsible person for %s", (_why, task, residents) => {
    expect(reasonLine(render(task, "pt-BR", [...residents]))).toBe("Por quê: Aguardando o morador responsável.");
    expect(reasonLine(render(task, "en-US", [...residents]))).toBe("Why: Waiting for the responsible person.");
  });

  it("leaves the other pool reasons as they were", () => {
    expect(reasonLine(render({ ...TASK, reason: "refused" }, "en-US", [ANA]))).toBe("Why: It was refused, so it is back in the pool.");
  });
});
