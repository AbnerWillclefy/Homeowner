import { describe, expect, it } from "vitest";
import { resultChange, resultCents } from "./result";

const month = (incomeCents: number, spentCents: number, savedCents: number) => ({ month: "2026-10", incomeCents, spentCents, savedCents });

describe("resultCents", () => {
  it("is income less spent less saved, negative when the month took more", () => {
    expect(resultCents(month(980000, 512741, 120000))).toBe(347259);
    expect(resultCents(month(100000, 90000, 30000))).toBe(-20000);
  });
});

describe("resultChange", () => {
  const previous = month(900000, 500000, 100000); // 300000

  it("is the rounded percent against the whole previous month", () => {
    expect(resultChange(month(980000, 512741, 120000), previous)).toBe(16);
    expect(resultChange(month(900000, 600000, 100000), previous)).toBe(-33);
  });

  it("is hidden when the previous month has no data", () => {
    expect(resultChange(month(980000, 512741, 120000), month(0, 0, 0))).toBeNull();
    expect(resultChange(month(980000, 512741, 120000), undefined)).toBeNull();
  });

  it("is hidden when the previous result is zero or negative: a percent of that base misleads", () => {
    expect(resultChange(month(1, 0, 0), month(100000, 100000, 0))).toBeNull();
    expect(resultChange(month(1, 0, 0), month(100000, 90000, 30000))).toBeNull();
  });
});
