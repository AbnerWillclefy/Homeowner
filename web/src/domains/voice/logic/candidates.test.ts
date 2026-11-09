import { describe, expect, it } from "vitest";
import type { PlainAction, VoiceAction } from "../api/api";
import { canConfirm, pick } from "./candidates";

const accept: PlainAction = { kind: "accept", taskId: "t1", choreName: "Laundry" };
const take: PlainAction = { kind: "take", taskId: "t2", choreName: "Laundry" };
const choice: VoiceAction = { kind: "choice", candidates: [accept, take] };

describe("pick", () => {
  it("returns the candidate's own kind and ids", () => {
    expect(pick(choice, 1)).toEqual(take);
  });
  it("leaves a plain action or an index out of range as it is", () => {
    expect(pick(accept, 0)).toBe(accept);
    expect(pick(choice, 5)).toBe(choice);
  });
});

describe("canConfirm", () => {
  it("is off with nothing to send", () => expect(canConfirm([])).toBe(false));
  it("is on with no ambiguous action", () => expect(canConfirm([accept])).toBe(true));
  it("is off while one or two are unpicked", () => {
    expect(canConfirm([accept, choice])).toBe(false);
    expect(canConfirm([choice, choice])).toBe(false);
  });
  it("is on once the choice is picked or removed", () => {
    expect(canConfirm([pick(choice, 0), accept])).toBe(true);
    expect(canConfirm([accept, choice].filter((a) => a.kind !== "choice"))).toBe(true);
  });
});
