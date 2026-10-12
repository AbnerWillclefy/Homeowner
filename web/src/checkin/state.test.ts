import { describe, expect, it } from "vitest";
import type { CheckIn, Level } from "../api/checkIn";
import { checkInReducer, checkInView, energyNote, noTasksReason, type CheckInState } from "./state";

const MISSING: CheckIn = { date: "2026-10-12", checkedIn: false, level: null, restrictions: [] };
const LOW: CheckIn = { date: "2026-10-12", checkedIn: true, level: "low", restrictions: ["bending"] };

const ready = (checkIn: CheckIn): CheckInState => ({ kind: "ready", checkIn });

describe("checkInView", () => {
  it("shows the prompt only when today's Check-in is missing", () => {
    expect(checkInView(ready(MISSING))).toBe("prompt");
    expect(checkInView(ready(LOW))).toBe("summary");
  });

  it("has no prompt while loading or after a failed load", () => {
    expect(checkInView({ kind: "loading" })).toBe("loading");
    expect(checkInView({ kind: "failed", reason: "offline" })).toBe("failed");
  });

  it("shows a saved Check-in as a summary: the form lives in the dialog, so there is no change view", () => {
    const saved = checkInReducer(ready(MISSING), { type: "saved", checkIn: LOW });
    expect(checkInView(saved)).toBe("summary");
  });

  it("asks again on every open: a new load of a missing Check-in is a prompt, nothing is remembered", () => {
    const reloaded = checkInReducer(ready(MISSING), { type: "loaded", checkIn: MISSING });
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

  it("holds the saved Check-in", () => {
    expect(checkInReducer(ready(MISSING), { type: "saved", checkIn: LOW })).toEqual(ready(LOW));
  });

  it("ignores a save before the Check-in is loaded", () => {
    expect(checkInReducer({ kind: "loading" }, { type: "saved", checkIn: LOW })).toEqual({ kind: "loading" });
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
