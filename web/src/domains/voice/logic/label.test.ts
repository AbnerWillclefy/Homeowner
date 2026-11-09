import { describe, expect, it } from "vitest";
import type { Translate } from "../../../shared/i18n";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import type { ChoreWire } from "../../chores/api/api";
import type { VoiceAction } from "../api/api";
import { actionLabel } from "./label";

const translator =
  (catalog: Record<string, unknown>): Translate =>
  (key, params) => {
    let text = String(catalog[key]);
    for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, String(value));
    return text;
  };
const en = translator(enUS);
const pt = translator(ptBR);

const body: ChoreWire = {
  name: "Regar as plantas",
  category: "outdoor",
  demands: [],
  baseEffort: 2,
  importance: "normal",
  people: 1,
  intervalDays: 7,
  allowedWeekdays: [],
  buildsUp: false,
};
const create = (choreName: string, chore: ChoreWire = body): VoiceAction => ({ kind: "create_chore", choreName, body: chore });

describe("actionLabel", () => {
  it("names a create by its name and schedule", () => {
    expect(actionLabel(create("Water the plants"), en, "en-US")).toBe("New Chore: Water the plants, Weekly");
    expect(actionLabel(create("Regar as plantas"), pt, "pt-BR")).toBe("Novo afazer: Regar as plantas, Semanal");
  });

  it("adds the weekdays to a create's schedule", () => {
    const monday = create("x", { ...body, allowedWeekdays: [1] });
    expect(actionLabel(monday, en, "en-US")).toBe("New Chore: x, Weekly, Only on Monday");
    expect(actionLabel(monday, pt, "pt-BR")).toBe("Novo afazer: x, Semanal, Só em segunda-feira");
  });

  it("shows the new value of each changed field of an edit", () => {
    const edit: VoiceAction = { kind: "edit_chore", choreId: "c1", choreName: "Mop", changed: ["intervalDays", "allowedWeekdays"], body };
    expect(actionLabel(edit, en, "en-US")).toBe("Change Mop: repeat Weekly, days any day");
    expect(actionLabel(edit, pt, "pt-BR")).toBe("Mudar Mop: repetição Semanal, dias qualquer dia");
  });

  it("words task actions and choices from the app's own text", () => {
    expect(actionLabel({ kind: "complete", taskId: "t", choreName: "Mop" }, en, "en-US")).toBe("Complete Mop");
    expect(actionLabel({ kind: "take", taskId: "t", choreName: "Mop" }, pt, "pt-BR")).toBe("Pegar Mop");
    expect(actionLabel({ kind: "choice", candidates: [] }, en, "en-US")).toBe("Several matches. Not applied.");
  });
});
