import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { Resident } from "../../residents/api/api";
import { assignmentReasonLabel, poolReasonLabel, waitingForText } from "./reasons";

const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
const ANA = { id: "r1", you: false, name: "Ana" } as Resident;

describe("waitingForText", () => {
  it.each([
    ["pt-BR", ANA, "Aguardando Ana."],
    ["en-US", ANA, "Waiting for Ana."],
    ["pt-BR", { ...ANA, you: true }, "Aguardando você."],
    ["en-US", { ...ANA, you: true }, "Waiting for you."],
    ["pt-BR", undefined, "Aguardando o morador responsável."],
    ["en-US", undefined, "Waiting for the responsible person."],
  ] as const)("in %s reads for %j", (locale, resident, text) => {
    expect(waitingForText((key, params) => translate(locale, key, params), resident)).toBe(text);
  });
});

describe("poolReasonLabel", () => {
  it("points at a catalog key for each reason id the API sends", () => {
    for (const id of [
      "no_energy_left",
      "restricted_for_all",
      "weekday_not_allowed",
      "two_person_deferred",
      "invalid_effort",
      "added_after_plan",
      "refused",
      "waiting_for_responsible",
    ]) {
      expect(poolReasonLabel(id)).toEqual({ key: `dayplan.pool.reason.${id}` });
    }
  });

  it("shows nothing for a Task with no reason, and the id for one the app does not know", () => {
    expect(poolReasonLabel(undefined)).toBeNull();
    expect(poolReasonLabel("")).toBeNull();
    expect(poolReasonLabel("something_new")).toEqual({ text: "something_new" });
  });
});

describe("assignmentReasonLabel", () => {
  it("points at a catalog key for each reason id the API sends", () => {
    for (const id of ["deadline_today", "importance", "lateness", "fits_energy", "taken", "liked", "spared_dislike", "turn_taking", "swapped"]) {
      expect(assignmentReasonLabel(id)).toEqual({ key: `dayplan.assigned.reason.${id}` });
    }
  });

  it("falls back like the pool does", () => {
    expect(assignmentReasonLabel(undefined)).toBeNull();
    expect(assignmentReasonLabel("other")).toEqual({ text: "other" });
  });
});
