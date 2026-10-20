import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { ACTION_FAILURE_KEY, conflictMessageKey, SWAP_CONFLICT_KEYS } from "./failureMessages";

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
    "drained",
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

// The codes the Swap routes send (backend/internal/dayplan/handler_actions.go, plus the 404 swap_not_found),
// written out so a drift in either list fails here.
const BACKEND_SWAP_CODES = [
  "not_yours",
  "not_held_by_other",
  "already_done",
  "two_person_task",
  "no_plan_today",
  "restricted",
  "recipient_drained",
  "swap_pending",
  "swap_not_found",
  "swap_closed",
  "swap_stale",
];

describe("conflictMessageKey for a Swap", () => {
  it("covers exactly the codes the backend sends", () => {
    expect(Object.keys(SWAP_CONFLICT_KEYS).sort()).toEqual([...BACKEND_SWAP_CODES].sort());
  });

  it.each(BACKEND_SWAP_CODES)("has a message in both languages for %s", (code) => {
    const key = conflictMessageKey(code, "swap");
    expect(both(key)).toBe(true);
    expect(key).toBe(`dayplan.swap.conflict.${code}`);
  });

  it("keeps the Swap wording apart from the Task wording", () => {
    for (const code of ["not_yours", "already_done", "two_person_task", "no_plan_today", "restricted"]) {
      expect(conflictMessageKey(code, "swap")).not.toBe(conflictMessageKey(code));
    }
  });

  it("leaves the Task table as it was", () => {
    expect(conflictMessageKey("restricted")).toBe("dayplan.conflict.restricted");
    expect(conflictMessageKey("restricted", "task")).toBe("dayplan.conflict.restricted");
    expect(conflictMessageKey("swap_stale")).toBe("dayplan.conflict.unknown");
  });

  it("is generic for a code the Swap table does not know, even one the Task table knows", () => {
    expect(conflictMessageKey("something_new", "swap")).toBe("dayplan.conflict.unknown");
    expect(conflictMessageKey("drained", "swap")).toBe("dayplan.conflict.unknown");
    expect(conflictMessageKey("toString", "swap")).toBe("dayplan.conflict.unknown");
  });
});
