import { describe, expect, it } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { viewOf, type QuerySnapshot } from "../../../shared/query/view";
import type { CheckIn, Level } from "../api/api";
import { checkInStateOf, checkInView, energyNote, noTasksReason, type CheckInState } from "./state";

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
});

const checkInSnap = (over: Partial<QuerySnapshot<CheckIn | null>>) =>
  viewOf<CheckIn | null>({ data: undefined, error: null, isFetching: true, ...over }).state;
const demandsSnap = (over: Partial<QuerySnapshot<string[]>>) =>
  viewOf<string[]>({ data: undefined, error: null, isFetching: true, ...over }).state;
const DEMANDS = demandsSnap({ data: ["bending"], isFetching: false });

describe("checkInStateOf", () => {
  it("is loading while either the Check-in or the Demand list loads", () => {
    expect(checkInStateOf(checkInSnap({}), DEMANDS)).toEqual({ kind: "loading" });
    expect(checkInStateOf(checkInSnap({ data: LOW, isFetching: false }), demandsSnap({}))).toEqual({ kind: "loading" });
  });

  it("is ready when both answered, and asks again when the Check-in is missing", () => {
    expect(checkInStateOf(checkInSnap({ data: LOW, isFetching: false }), DEMANDS)).toEqual(ready(LOW));
    const missing = checkInStateOf(checkInSnap({ data: MISSING, isFetching: false }), DEMANDS);
    expect(checkInView(missing)).toBe("prompt");
  });

  it("fails with the Check-in's failure first, then the Demand list's", () => {
    const checkInFailed = checkInSnap({ error: new ApiFailure("offline"), isFetching: false });
    const demandsFailed = demandsSnap({ error: new ApiFailure("error"), isFetching: false });
    expect(checkInStateOf(checkInFailed, demandsFailed)).toEqual({ kind: "failed", reason: "offline" });
    expect(checkInStateOf(checkInSnap({ data: LOW, isFetching: false }), demandsFailed)).toEqual({
      kind: "failed",
      reason: "error",
    });
  });

  it("fails with none when the caller has no Home (null Check-in)", () => {
    expect(checkInStateOf(checkInSnap({ data: null, isFetching: false }), DEMANDS)).toEqual({
      kind: "failed",
      reason: "none",
    });
  });

  it("keeps the Check-in on screen when a background refetch failed", () => {
    const refetchFailed = checkInSnap({ data: LOW, error: new ApiFailure("offline"), isFetching: false });
    expect(checkInStateOf(refetchFailed, DEMANDS)).toEqual(ready(LOW));
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
