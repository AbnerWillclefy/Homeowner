import { describe, expect, it } from "vitest";
import type { Profile } from "./api";
import { withBaseline, withPreference, withRestriction } from "./changes";

const base: Profile = {
  baseline: { sunday: null, monday: 5, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null },
  preferences: { kitchen: "dislike" },
  restrictions: ["bending"],
};

describe("withBaseline", () => {
  it("sets or clears one day and leaves the input untouched", () => {
    const next = withBaseline(base, "tuesday", 0);
    expect(next.baseline.tuesday).toBe(0);
    expect(next.baseline.monday).toBe(5);
    expect(base.baseline.tuesday).toBeNull();
    expect(withBaseline(base, "monday", null).baseline.monday).toBeNull();
  });
});

describe("withPreference", () => {
  it("stores like and dislike", () => {
    expect(withPreference(base, "pets", "like").preferences).toEqual({ kitchen: "dislike", pets: "like" });
  });

  it("drops the entry for neutral, because unset means neutral", () => {
    expect(withPreference(base, "kitchen", "neutral").preferences).toEqual({});
    expect(base.preferences).toEqual({ kitchen: "dislike" });
  });
});

describe("withRestriction", () => {
  it("adds a Demand once and removes it again", () => {
    const added = withRestriction(base, "heights", true);
    expect(added.restrictions).toEqual(["bending", "heights"]);
    expect(withRestriction(added, "heights", true).restrictions).toEqual(["bending", "heights"]);
    expect(withRestriction(added, "bending", false).restrictions).toEqual(["heights"]);
    expect(base.restrictions).toEqual(["bending"]);
  });
});
