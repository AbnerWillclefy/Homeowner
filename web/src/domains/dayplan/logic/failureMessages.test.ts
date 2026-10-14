import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { ACTION_FAILURE_KEY, conflictMessageKey } from "./failureMessages";

const both = (key: string) => key in enUS && key in ptBR;

describe("conflictMessageKey", () => {
  it.each([
    "no_plan_today",
    "not_proposed",
    "already_committed",
    "not_in_pool",
    "not_yours",
    "already_done",
    "two_person_task",
    "restricted",
  ])("has a message in both languages for the API's %s", (code) => {
    const key = conflictMessageKey(code);
    expect(both(key)).toBe(true);
    expect(key).toBe(`dayplan.conflict.${code}`);
  });

  it("has a generic message for a code the app does not know, never one built from the code", () => {
    expect(conflictMessageKey("unknown")).toBe("dayplan.conflict.unknown");
    expect(conflictMessageKey("something_new")).toBe("dayplan.conflict.unknown");
    expect(conflictMessageKey("toString")).toBe("dayplan.conflict.unknown");
  });
});

describe("ACTION_FAILURE_KEY", () => {
  it("has a message in both languages for each failure kind", () => {
    for (const key of Object.values(ACTION_FAILURE_KEY)) expect(both(key)).toBe(true);
    expect(Object.keys(ACTION_FAILURE_KEY).sort()).toEqual(["error", "none", "not-signed-in", "offline"]);
  });
});
