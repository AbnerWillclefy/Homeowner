import { describe, expect, it } from "vitest";
import type { CheckIn, Level } from "../api/checkIn";
import { checkInReducer, checkInView, energyNote, noTasksReason, type CheckInState } from "./state";

const MISSING: CheckIn = { date: "2026-10-12", checkedIn: false, level: null, restrictions: [] };
const LOW: CheckIn = { date: "2026-10-12", checkedIn: true, level: "low", restrictions: ["bending"] };

const ready = (checkIn: CheckIn, extra: Partial<Extract<CheckInState, { kind: "ready" }>> = {}): CheckInState => ({
  kind: "ready",
  checkIn,
  editing: false,
  saving: false,
  saveFailure: null,
  saved: false,
  ...extra,
});

describe("checkInView", () => {
  it("shows the prompt only when today's Check-in is missing", () => {
    expect(checkInView(ready(MISSING))).toBe("prompt");
    expect(checkInView(ready(LOW))).toBe("summary");
  });

  it("has no prompt while loading or after a failed load", () => {
    expect(checkInView({ kind: "loading" })).toBe("loading");
    expect(checkInView({ kind: "failed", reason: "offline" })).toBe("failed");
  });

  it("reopens the form with Change, and goes back with Cancel", () => {
    const editing = checkInReducer(ready(LOW), { type: "edit" });
    expect(checkInView(editing)).toBe("change");
    expect(checkInView(checkInReducer(editing, { type: "cancel" }))).toBe("summary");
  });

  it("asks again on every open: a new load of a missing Check-in is a prompt, nothing is remembered", () => {
    const dismissedLike = checkInReducer(ready(MISSING), { type: "cancel" });
    expect(checkInView(dismissedLike)).toBe("prompt");
    const reloaded = checkInReducer(dismissedLike, { type: "loaded", checkIn: MISSING });
    expect(checkInView(reloaded)).toBe("prompt");
  });
});

describe("checkInReducer", () => {
  it("loads, or fails to load", () => {
    expect(checkInReducer({ kind: "loading" }, { type: "loaded", checkIn: LOW })).toEqual(ready(LOW));
    expect(checkInReducer({ kind: "loading" }, { type: "load-failed", reason: "none" })).toEqual({
      kind: "failed",
      reason: "none",
    });
    expect(checkInReducer({ kind: "failed", reason: "error" }, { type: "load" })).toEqual({ kind: "loading" });
  });

  it("marks saving, then shows the saved Check-in as a summary with a saved notice", () => {
    const saving = checkInReducer(ready(MISSING), { type: "save-started" });
    expect(saving).toEqual(ready(MISSING, { saving: true }));
    expect(checkInReducer(saving, { type: "saved", checkIn: LOW })).toEqual(ready(LOW, { saved: true }));
  });

  it("keeps the form open with the failure after a failed save, and clears it on the next try", () => {
    const editing = checkInReducer(ready(LOW), { type: "edit" });
    const failed = checkInReducer(checkInReducer(editing, { type: "save-started" }), {
      type: "save-failed",
      reason: "offline",
    });
    expect(failed).toEqual(ready(LOW, { editing: true, saveFailure: "offline" }));
    expect(checkInReducer(failed, { type: "save-started" })).toEqual(ready(LOW, { editing: true, saving: true }));
  });

  it("ignores save events before the Check-in is loaded", () => {
    expect(checkInReducer({ kind: "loading" }, { type: "save-started" })).toEqual({ kind: "loading" });
  });
});

describe("energyNote", () => {
  const checked = (level: Level) => ({ checkedIn: true, level });
  const NONE = { checkedIn: false, level: null };

  it.each([
    ["no Check-in yet invites one, whatever the plan says", null, NONE, "unset"],
    ["no Check-in with a stale Energy is still unset", 4, NONE, "unset"],
    ["Drained is said gently, before the Energy value", 0, checked("drained"), "drained"],
    ["Drained wins even if the plan still shows points", 3, checked("drained"), "drained"],
    ["points show when there is Energy", 5, checked("low"), "energy"],
    ["Energy 0 after a Check-in means no Baseline", 0, checked("normal"), "no-baseline"],
    ["checked in with the plan not ready is pending, never unset or 0", null, checked("normal"), "pending"],
  ] as const)("%s", (_name, energy, checkIn, note) => {
    expect(energyNote(energy, checkIn)).toBe(note);
  });
});

describe("noTasksReason", () => {
  it.each([
    ["drained", "drained"],
    ["no-baseline", "no-baseline"],
    ["energy", "nothing-due"],
    ["pending", "nothing-due"],
    ["unset", "nothing-due"],
  ] as const)("an empty list after %s is explained as %s", (note, reason) => {
    expect(noTasksReason(note)).toBe(reason);
  });
});
