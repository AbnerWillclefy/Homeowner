import { describe, expect, it } from "vitest";
import { BASELINE_LEVELS, levelToPoints, pointsToLevel } from "./baselineLevels";

describe("levelToPoints", () => {
  it("gives Low 4, Normal 8 and High 14", () => {
    expect(levelToPoints("low")).toBe(4);
    expect(levelToPoints("normal")).toBe(8);
    expect(levelToPoints("high")).toBe(14);
  });

  it("keeps the points increasing and inside what the API accepts", () => {
    const points = BASELINE_LEVELS.map(levelToPoints);
    expect(points).toEqual([...points].sort((a, b) => a - b));
    expect(new Set(points).size).toBe(points.length);
    for (const p of points) {
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(20);
    }
  });
});

describe("pointsToLevel", () => {
  it("shows no level for an unset day", () => {
    expect(pointsToLevel(null)).toBeNull();
  });

  it("reads each level's own points back as that level", () => {
    for (const level of BASELINE_LEVELS) expect(pointsToLevel(levelToPoints(level))).toBe(level);
  });

  it("shows legacy values as the nearest level", () => {
    expect(pointsToLevel(0)).toBe("low");
    expect(pointsToLevel(3)).toBe("low");
    expect(pointsToLevel(7)).toBe("normal");
    expect(pointsToLevel(12)).toBe("high");
    expect(pointsToLevel(20)).toBe("high");
  });

  it("sends a tie to the lower level, so a legacy value never promises more Energy", () => {
    expect(pointsToLevel(6)).toBe("low");
    expect(pointsToLevel(11)).toBe("normal");
  });

  it("gives a level for every whole number from 0 to 20", () => {
    for (let points = 0; points <= 20; points++) expect(pointsToLevel(points)).not.toBeNull();
  });
});
