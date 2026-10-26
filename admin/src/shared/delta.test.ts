import { describe, expect, it } from "vitest";
import { changeDelta, describeDelta, MIN_MONEY_BASE_MICROS, MIN_PERCENT_BASE, rateDelta } from "./delta";

describe("changeDelta for counts", () => {
  it("is a percent change for an increase and a decrease", () => {
    expect(changeDelta("count", 150, 100)).toEqual({ type: "percent", change: 50 });
    expect(changeDelta("count", 75, 100)).toEqual({ type: "percent", change: -25 });
  });
  it("is same when nothing changed", () => {
    expect(changeDelta("count", 40, 40)).toEqual({ type: "same" });
    expect(changeDelta("count", 0, 0)).toEqual({ type: "same" });
  });
  it("is new when the previous was 0 and the current is not, never a percentage", () => {
    expect(changeDelta("count", 5, 0)).toEqual({ type: "new" });
  });
  it("is the absolute change when the previous is below the base", () => {
    expect(MIN_PERCENT_BASE).toBe(10);
    expect(changeDelta("count", 7, 3)).toEqual({ type: "absolute", change: 4 });
    expect(changeDelta("count", 0, 3)).toEqual({ type: "absolute", change: -3 });
    expect(changeDelta("count", 15, 10)).toEqual({ type: "percent", change: 50 });
  });
  it("is none without a previous block", () => {
    expect(changeDelta("count", 5, undefined)).toEqual({ type: "none" });
  });
});

describe("changeDelta for money", () => {
  it("is a percent change from the base up, and absolute micros below it", () => {
    expect(changeDelta("money", 1_500_000, 1_000_000)).toEqual({ type: "percent", change: 50 });
    expect(changeDelta("money", 1_000, 0)).toEqual({ type: "new" });
    expect(changeDelta("money", 5_000, 2_000)).toEqual({ type: "absolute", change: 3_000 });
    expect(MIN_MONEY_BASE_MICROS).toBe(10_000);
    expect(changeDelta("money", 5, undefined)).toEqual({ type: "none" });
  });
});

describe("rateDelta", () => {
  it("is the change in percentage points", () => {
    expect(rateDelta({ part: 25, whole: 100 }, { part: 22, whole: 100 })).toEqual({ type: "points", change: 3 });
    expect(rateDelta({ part: 10, whole: 100 }, { part: 30, whole: 100 })).toEqual({ type: "points", change: -20 });
  });
  it("is same when the points do not change", () => {
    expect(rateDelta({ part: 1, whole: 4 }, { part: 25, whole: 100 })).toEqual({ type: "same" });
  });
  it("is none when either side has no denominator, or there is no previous block", () => {
    expect(rateDelta({ part: 1, whole: 4 }, { part: 0, whole: 0 })).toEqual({ type: "none" });
    expect(rateDelta({ part: 0, whole: 0 }, { part: 1, whole: 4 })).toEqual({ type: "none" });
    expect(rateDelta({ part: 1, whole: 4 }, undefined)).toEqual({ type: "none" });
  });
});

describe("describeDelta text", () => {
  it("writes points as pp and never shows a % for a rate", () => {
    expect(describeDelta("rate", { type: "points", change: 3 }, 7).text).toBe("+3 pp");
    expect(describeDelta("rate", { type: "points", change: -20 }, 7).text).toBe("-20 pp");
  });
  it("labels count and money changes as partial-day", () => {
    expect(describeDelta("count", { type: "percent", change: 50 }, 7).text).toBe("+50% (count; today is partial)");
    expect(describeDelta("count", { type: "absolute", change: -3 }, 7).text).toBe("-3 (count; today is partial)");
    expect(describeDelta("count", { type: "new" }, 7).text).toBe("new (count; today is partial)");
    expect(describeDelta("money", { type: "absolute", change: 3_000 }, 7).text).toBe("+$0.0030 (today is partial)");
  });
  it("says no change, and nothing at all for none", () => {
    expect(describeDelta("rate", { type: "same" }, 7).text).toBe("no change");
    expect(describeDelta("rate", { type: "none" }, 7).text).toBe("");
  });
  it("never writes Infinity or NaN", () => {
    const results = [changeDelta("count", 5, 0), rateDelta({ part: 1, whole: 0 }, { part: 0, whole: 0 })];
    const text = results.map((d) => describeDelta("count", d, 7).text).join();
    expect(text).not.toMatch(/Infinity|NaN/);
  });
});

describe("describeDelta arrow", () => {
  it("points up or down for a change with a direction, and nowhere otherwise", () => {
    expect(describeDelta("rate", { type: "points", change: 3 }, 7).arrow).toBe("↑");
    expect(describeDelta("count", { type: "absolute", change: -3 }, 7).arrow).toBe("↓");
    expect(describeDelta("count", { type: "percent", change: -50 }, 7).arrow).toBe("↓");
    expect(describeDelta("count", { type: "new" }, 7).arrow).toBe("");
    expect(describeDelta("rate", { type: "same" }, 7).arrow).toBe("");
  });
});

describe("describeDelta speech", () => {
  it("spells the change out against the previous range", () => {
    expect(describeDelta("rate", { type: "points", change: 3 }, 7).speech).toBe("up 3 percentage points against the previous 7 days");
    expect(describeDelta("rate", { type: "points", change: -2 }, 30).speech).toBe(
      "down 2 percentage points against the previous 30 days",
    );
    expect(describeDelta("count", { type: "percent", change: 50 }, 7).speech).toBe(
      "up 50 percent against the previous 7 days (count; today is partial)",
    );
    expect(describeDelta("count", { type: "new" }, 7).speech).toBe("new, none in the previous 7 days (count; today is partial)");
    expect(describeDelta("rate", { type: "same" }, 7).speech).toBe("no change against the previous 7 days");
    expect(describeDelta("rate", { type: "none" }, 7).speech).toBe("");
  });
});
