import { describe, expect, it } from "vitest";
import type { Baseline } from "../profile/api";
import { allBaselineDaysSet } from "./baselineComplete";

const FULL: Baseline = {
  sunday: 3,
  monday: 5,
  tuesday: 5,
  wednesday: 5,
  thursday: 5,
  friday: 4,
  saturday: 2,
};

describe("allBaselineDaysSet", () => {
  it("is true when all seven days have a value", () => {
    expect(allBaselineDaysSet(FULL)).toBe(true);
  });

  it("counts 0 as a value", () => {
    expect(allBaselineDaysSet({ ...FULL, sunday: 0, monday: 0 })).toBe(true);
  });

  it("is false when any one day is unset", () => {
    expect(allBaselineDaysSet({ ...FULL, wednesday: null })).toBe(false);
  });

  it("is false when no day is set", () => {
    const empty: Baseline = {
      sunday: null,
      monday: null,
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
    };
    expect(allBaselineDaysSet(empty)).toBe(false);
  });
});
