import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { MOVE_REJECTIONS, type MoveResult } from "../api/api";
import { MOVE_FAILURE_KEY, moveFailureKey, pickedProblemKey } from "./moveFailures";

const both = (key: string) => key in enUS && key in ptBR;

// Every non-ok answer the client can get. A new MoveResult kind or code fails the typecheck in moveFailures.ts first.
const FAILURES: Exclude<MoveResult, { kind: "ok" }>[] = [
  ...MOVE_REJECTIONS.map((code) => ({ kind: "rejected", code }) as const),
  { kind: "not-found" },
  { kind: "none" },
  { kind: "not-signed-in" },
  { kind: "offline" },
  { kind: "error" },
];

describe("moveFailureKey", () => {
  it.each(FAILURES)("has a message in both languages for %j", (failure) => {
    expect(both(moveFailureKey(failure))).toBe(true);
  });

  it("covers every key of the table, so none is dead", () => {
    const used = new Set(FAILURES.map(moveFailureKey));
    expect(used).toEqual(new Set(Object.values(MOVE_FAILURE_KEY)));
  });

  it("gives each rejection its own calm wording and never an alarm mark", () => {
    const keys = MOVE_REJECTIONS.map((code) => moveFailureKey({ kind: "rejected", code }));
    expect(new Set(keys).size).toBe(MOVE_REJECTIONS.length);
    for (const key of Object.values(MOVE_FAILURE_KEY)) {
      expect(enUS[key]).not.toContain("!");
      expect(ptBR[key]).not.toContain("!");
    }
  });
});

describe("pickedProblemKey", () => {
  it("words a bound the picker caught the same as the server's", () => {
    expect(pickedProblemKey("in_future")).toBe(moveFailureKey({ kind: "rejected", code: "in_future" }));
    expect(pickedProblemKey("too_old")).toBe(moveFailureKey({ kind: "rejected", code: "too_old" }));
    expect(pickedProblemKey("invalid")).toBe(moveFailureKey({ kind: "rejected", code: "invalid_completed_at" }));
  });
});
