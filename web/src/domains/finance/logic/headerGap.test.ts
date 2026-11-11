import { describe, expect, it } from "vitest";
import { headerGap } from "./headerGap";

describe("headerGap", () => {
  it("is earlier purchases when Committed is above Spent", () => {
    expect(headerGap(90000, 61000)).toEqual({ key: "earlier", amount: 29000 });
  });
  it("is later bills when Spent is above Committed", () => {
    expect(headerGap(40000, 55000)).toEqual({ key: "later", amount: 15000 });
  });
  it("is nothing when they match", () => {
    expect(headerGap(500, 500)).toBeNull();
  });
});
