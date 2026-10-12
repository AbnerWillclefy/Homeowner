import { describe, expect, it } from "vitest";
import type { CheckIn } from "../api/checkIn";
import { checkInReducer, checkInView, energyNote, type CheckInState } from "./state";

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
  it("explains a Drained day instead of blaming the Baseline", () => {
    expect(energyNote(0, "drained")).toBe("drained");
  });

  it("hints at setting a Baseline when Energy is 0 and the level is not Drained", () => {
    expect(energyNote(0, "normal")).toBe("no-baseline");
    expect(energyNote(null, null)).toBe("no-baseline");
  });

  it("shows the Energy otherwise", () => {
    expect(energyNote(5, "low")).toBe("energy");
    expect(energyNote(3, null)).toBe("energy");
  });
});
