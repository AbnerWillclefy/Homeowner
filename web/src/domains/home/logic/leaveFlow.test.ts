import { describe, expect, it } from "vitest";
import { leaveReducer, type LeaveState } from "./leaveFlow";

const closed: LeaveState = { kind: "closed" };
const confirming: LeaveState = { kind: "confirming" };
const leaving: LeaveState = { kind: "leaving" };

describe("leaveReducer", () => {
  it("opens the confirmation from closed", () => {
    expect(leaveReducer(closed, { type: "open" })).toEqual({ kind: "confirming" });
  });

  it("ignores open unless closed", () => {
    expect(leaveReducer(leaving, { type: "open" })).toBe(leaving);
    const failed: LeaveState = { kind: "confirming", failed: "error" };
    expect(leaveReducer(failed, { type: "open" })).toBe(failed);
  });

  it("closes on cancel", () => {
    expect(leaveReducer(confirming, { type: "cancel" })).toEqual({ kind: "closed" });
  });

  it("cannot be cancelled while the request is in flight", () => {
    expect(leaveReducer(leaving, { type: "cancel" })).toBe(leaving);
  });

  it("moves to leaving on confirm, only from confirming", () => {
    expect(leaveReducer(confirming, { type: "confirm" })).toEqual({ kind: "leaving" });
    expect(leaveReducer(closed, { type: "confirm" })).toBe(closed);
    expect(leaveReducer(leaving, { type: "confirm" })).toBe(leaving);
  });

  it.each(["offline", "error", "not-signed-in"] as const)(
    "returns to confirming with the reason on %s, and allows a retry",
    (reason) => {
      const failed = leaveReducer(leaving, { type: "failed", reason });
      expect(failed).toEqual({ kind: "confirming", failed: reason });
      expect(leaveReducer(failed, { type: "confirm" })).toEqual({ kind: "leaving" });
    },
  );

  it("closes when done", () => {
    expect(leaveReducer(leaving, { type: "done" })).toEqual({ kind: "closed" });
  });

  it("clears an earlier failure when closed and opened again", () => {
    let state = leaveReducer(leaving, { type: "failed", reason: "error" });
    state = leaveReducer(state, { type: "cancel" });
    expect(leaveReducer(state, { type: "open" })).toEqual({ kind: "confirming" });
  });

  it("ignores failed and done when no request is in flight", () => {
    expect(leaveReducer(closed, { type: "done" })).toBe(closed);
    expect(leaveReducer(confirming, { type: "failed", reason: "error" })).toBe(confirming);
  });
});
