import { describe, expect, it } from "vitest";
import { incomeSplit } from "./incomeSplit";

describe("incomeSplit", () => {
  it("is null while no income is set", () => {
    expect(incomeSplit(null, 1000, 500)).toBeNull();
  });

  it("leaves what is not spent or unpaid, on the income scale", () => {
    expect(incomeSplit(500000, 120000, 80000)).toEqual({ spent: 120000, unpaid: 80000, left: 300000, over: 0, scale: 500000 });
  });

  it("has nothing left when the income is exactly used", () => {
    expect(incomeSplit(200000, 150000, 50000)).toMatchObject({ left: 0, over: 0, scale: 200000 });
  });

  it("reports how far over, and scales the bar to spent plus unpaid so it never passes 100%", () => {
    const split = incomeSplit(100000, 90000, 30000)!;
    expect(split).toMatchObject({ left: -20000, over: 20000, scale: 120000 });
    expect(split.spent + split.unpaid).toBe(split.scale);
  });

  it("with no spending and no unpaid Bills, all of it is left", () => {
    expect(incomeSplit(100000, 0, 0)).toEqual({ spent: 0, unpaid: 0, left: 100000, over: 0, scale: 100000 });
  });

  it("counts a refund-heavy month (negative spend) as nothing spent", () => {
    expect(incomeSplit(100000, -2000, 0)).toMatchObject({ spent: 0, left: 100000 });
  });
});
