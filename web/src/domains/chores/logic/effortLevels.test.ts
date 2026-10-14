import { describe, expect, it } from "vitest";
import { EFFORT_LEVELS, effortToLevel, levelToEffort } from "./effortLevels";

describe("effortToLevel", () => {
  it("names each Effort from 1 to 5", () => {
    expect([1, 2, 3, 4, 5].map(effortToLevel)).toEqual(["very_light", "light", "medium", "heavy", "very_heavy"]);
  });

  it("is null for anything that is not a whole number from 1 to 5, never throwing", () => {
    for (const n of [0, 6, -1, 2.5, NaN, Infinity]) expect(effortToLevel(n)).toBeNull();
  });
});

describe("levelToEffort", () => {
  it("gives each level its number", () => {
    expect(EFFORT_LEVELS.map(levelToEffort)).toEqual([1, 2, 3, 4, 5]);
  });

  it("round-trips both ways", () => {
    for (const n of [1, 2, 3, 4, 5]) expect(levelToEffort(effortToLevel(n)!)).toBe(n);
    for (const level of EFFORT_LEVELS) expect(effortToLevel(levelToEffort(level))).toBe(level);
  });
});
