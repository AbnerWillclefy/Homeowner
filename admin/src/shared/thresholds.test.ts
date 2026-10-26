import { describe, expect, it } from "vitest";
import { fallbackStatus, MIN_ALLOCATOR_CALLS, MIN_PROPOSED_PER_ARM, monthStatus, refereeStatus } from "./thresholds";

const NOT_ENOUGH = { state: "neutral", label: "Not enough data" };

describe("minimum sample", () => {
  it("names the minimums", () => {
    expect(MIN_PROPOSED_PER_ARM).toBe(20);
    expect(MIN_ALLOCATOR_CALLS).toBe(20);
  });
});

describe("fallbackStatus (warn above 20%, bad above 40%)", () => {
  it("is ok at and below 20%", () => {
    expect(fallbackStatus(0, 100).state).toBe("ok");
    expect(fallbackStatus(20, 100).state).toBe("ok");
    expect(fallbackStatus(4, 20).state).toBe("ok");
  });
  it("is warn just above 20% and still at 40%", () => {
    expect(fallbackStatus(21, 100).state).toBe("warn");
    expect(fallbackStatus(5, 20).state).toBe("warn");
    expect(fallbackStatus(40, 100).state).toBe("warn");
    expect(fallbackStatus(8, 20).state).toBe("warn");
  });
  it("is bad just above 40%", () => {
    expect(fallbackStatus(41, 100).state).toBe("bad");
    expect(fallbackStatus(9, 20).state).toBe("bad");
    expect(fallbackStatus(100, 100).state).toBe("bad");
  });
  it("is neutral Not enough data below the sample, even at 90%", () => {
    expect(fallbackStatus(18, 19)).toEqual(NOT_ENOUGH);
    expect(fallbackStatus(1, 5)).toEqual(NOT_ENOUGH);
    expect(fallbackStatus(0, 0)).toEqual(NOT_ENOUGH);
  });
  it("has a text label for every state", () => {
    for (const r of [fallbackStatus(0, 100), fallbackStatus(30, 100), fallbackStatus(50, 100)]) expect(r.label).not.toBe("");
  });
});

describe("refereeStatus (warn above 15%)", () => {
  it("is ok at 15% and warn just above", () => {
    expect(refereeStatus(0, 100).state).toBe("ok");
    expect(refereeStatus(15, 100).state).toBe("ok");
    expect(refereeStatus(3, 20).state).toBe("ok");
    expect(refereeStatus(16, 100).state).toBe("warn");
    expect(refereeStatus(4, 20).state).toBe("warn");
  });
  it("has no bad state", () => expect(refereeStatus(100, 100).state).toBe("warn"));
  it("is neutral Not enough data below the sample, even at 90%", () => {
    expect(refereeStatus(17, 19)).toEqual(NOT_ENOUGH);
  });
});

describe("monthStatus (warn above 80% of the limit, bad above 100%)", () => {
  const limit = 25_000_000;
  it("is ok at 80% and below", () => {
    expect(monthStatus(0, limit).state).toBe("ok");
    expect(monthStatus(20_000_000, limit).state).toBe("ok");
  });
  it("is warn just above 80% and still at 100%", () => {
    expect(monthStatus(20_000_001, limit).state).toBe("warn");
    expect(monthStatus(25_000_000, limit).state).toBe("warn");
  });
  it("is bad just above 100%", () => {
    expect(monthStatus(25_000_001, limit).state).toBe("bad");
  });
  it("is neutral No limit set when there is no limit", () => {
    expect(monthStatus(99_000_000, null)).toEqual({ state: "neutral", label: "No limit set" });
    expect(monthStatus(1, 0)).toEqual({ state: "neutral", label: "No limit set" });
  });
});
