import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import type { PlainAction } from "../api/api";
import { speechError } from "./errors";
import { failureKey } from "./failure";

const task: PlainAction = { kind: "complete", taskId: "t1", choreName: "Laundry" };
const edit = { kind: "edit_chore", choreId: "c1", choreName: "Mop", changed: [], body: {} } as unknown as PlainAction;

describe("failureKey", () => {
  it.each([
    [task, "conflict:already_done", "dayplan.conflict.already_done"],
    [task, "conflict:something_new", "dayplan.conflict.unknown"],
    [task, "offline", "dayplan.action.failed.offline"],
    [task, "weird", "dayplan.action.failed.error"],
    [edit, "none", "chores.form.save.gone"],
    [edit, "invalid", "chores.field.unknown"],
    [edit, "weird", "chores.form.save.error"],
  ])("%j with %s gives %s, defined in both catalogs", (action, reason, key) => {
    const got = failureKey(action, reason);
    expect(got).toBe(key);
    expect(enUS[got]).toBeTruthy();
    expect(ptBR[got]).toBeTruthy();
  });
});

describe("speechError", () => {
  it.each([
    ["service-not-allowed", "device"],
    ["not-allowed", "permission"],
    ["no-speech", "nothing"],
    ["aborted", "nothing"],
    ["network", "error"],
    ["audio-capture", "error"],
    ["something-else", "error"],
  ])("%s is %s", (code, message) => {
    expect(speechError(code)).toBe(message);
  });
});
