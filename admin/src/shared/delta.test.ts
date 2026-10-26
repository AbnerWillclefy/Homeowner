import { describe, expect, it } from "vitest";
import { delta, deltaSpeech, formatDelta, MIN_MONEY_BASE_MICROS, MIN_PERCENT_BASE } from "./delta";

describe("delta for counts", () => {
  it("is a percent change for an increase and a decrease", () => {
    expect(delta("count", 150, 100)).toEqual({ type: "percent", change: 50 });
    expect(delta("count", 75, 100)).toEqual({ type: "percent", change: -25 });
  });
  it("is same when nothing changed", () => {
    expect(delta("count", 40, 40)).toEqual({ type: "same" });
    expect(delta("count", 0, 0)).toEqual({ type: "same" });
  });
  it("is new when the previous was 0 and the current is not, never a percentage", () => {
    expect(delta("count", 5, 0)).toEqual({ type: "new" });
  });
  it("is the absolute change when the previous is below the base", () => {
    expect(MIN_PERCENT_BASE).toBe(10);
    expect(delta("count", 7, 3)).toEqual({ type: "absolute", change: 4 });
    expect(delta("count", 0, 3)).toEqual({ type: "absolute", change: -3 });
    expect(delta("count", 15, 10)).toEqual({ type: "percent", change: 50 });
  });
  it("is none without a previous block", () => {
    expect(delta("count", 5, undefined)).toEqual({ type: "none" });
  });
});

describe("delta for money", () => {
  it("is a percent change from the base up, and absolute micros below it", () => {
    expect(delta("money", 1_500_000, 1_000_000)).toEqual({ type: "percent", change: 50 });
    expect(delta("money", 1_000, 0)).toEqual({ type: "new" });
    expect(delta("money", 5_000, 2_000)).toEqual({ type: "absolute", change: 3_000 });
    expect(MIN_MONEY_BASE_MICROS).toBe(10_000);
    expect(delta("money", 5, undefined)).toEqual({ type: "none" });
  });
});

describe("delta for rates", () => {
  it("is the change in percentage points", () => {
    expect(delta("rate", { part: 25, whole: 100 }, { part: 22, whole: 100 })).toEqual({ type: "points", change: 3 });
    expect(delta("rate", { part: 10, whole: 100 }, { part: 30, whole: 100 })).toEqual({ type: "points", change: -20 });
  });
  it("is same when the points do not change", () => {
    expect(delta("rate", { part: 1, whole: 4 }, { part: 25, whole: 100 })).toEqual({ type: "same" });
  });
  it("is none when either side has no denominator, or there is no previous block", () => {
    expect(delta("rate", { part: 1, whole: 4 }, { part: 0, whole: 0 })).toEqual({ type: "none" });
    expect(delta("rate", { part: 0, whole: 0 }, { part: 1, whole: 4 })).toEqual({ type: "none" });
    expect(delta("rate", { part: 1, whole: 4 }, undefined)).toEqual({ type: "none" });
  });
});

describe("formatDelta", () => {
  it("writes points as pp and never shows a % for a rate", () => {
    expect(formatDelta("rate", { type: "points", change: 3 })).toBe("+3 pp");
    expect(formatDelta("rate", { type: "points", change: -20 })).toBe("-20 pp");
  });
  it("labels count and money changes as partial-day", () => {
    expect(formatDelta("count", { type: "percent", change: 50 })).toBe("+50% (count; today is partial)");
    expect(formatDelta("count", { type: "absolute", change: -3 })).toBe("-3 (count; today is partial)");
    expect(formatDelta("count", { type: "new" })).toBe("new (count; today is partial)");
    expect(formatDelta("money", { type: "absolute", change: 3_000 })).toBe("+$0.0030 (today is partial)");
  });
  it("says no change, and nothing at all for none", () => {
    expect(formatDelta("rate", { type: "same" })).toBe("no change");
    expect(formatDelta("rate", { type: "none" })).toBe("");
  });
  it("never writes Infinity or NaN", () => {
    const text = [delta("count", 5, 0), delta("rate", { part: 1, whole: 0 }, { part: 0, whole: 0 })].map((d) => formatDelta("count", d)).join();
    expect(text).not.toMatch(/Infinity|NaN/);
  });
});

describe("deltaSpeech", () => {
  it("spells the change out against the previous range", () => {
    expect(deltaSpeech("rate", { type: "points", change: 3 }, 7)).toBe("up 3 percentage points against the previous 7 days");
    expect(deltaSpeech("rate", { type: "points", change: -2 }, 30)).toBe("down 2 percentage points against the previous 30 days");
    expect(deltaSpeech("count", { type: "percent", change: 50 }, 7)).toBe(
      "up 50 percent against the previous 7 days (count; today is partial)",
    );
    expect(deltaSpeech("count", { type: "new" }, 7)).toBe("new, none in the previous 7 days (count; today is partial)");
    expect(deltaSpeech("rate", { type: "same" }, 7)).toBe("no change against the previous 7 days");
    expect(deltaSpeech("rate", { type: "none" }, 7)).toBe("");
  });
});
