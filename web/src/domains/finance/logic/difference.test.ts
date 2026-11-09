import { describe, expect, it } from "vitest";
import { difference } from "./difference";

describe("difference", () => {
  it("says more, less or the same, with the size of the gap", () => {
    expect(difference(81200, 69200)).toEqual({ key: "more", amount: 12000 });
    expect(difference(69200, 81200)).toEqual({ key: "less", amount: 12000 });
    expect(difference(5000, 5000)).toEqual({ key: "same", amount: 0 });
  });

  it("counts a zero previous month as more, and a zero month as less", () => {
    expect(difference(5000, 0)).toEqual({ key: "more", amount: 5000 });
    expect(difference(0, 5000)).toEqual({ key: "less", amount: 5000 });
  });

  it("works across negatives (refund-heavy months)", () => {
    expect(difference(-2000, 3000)).toEqual({ key: "less", amount: 5000 });
    expect(difference(1000, -2000)).toEqual({ key: "more", amount: 3000 });
  });
});
