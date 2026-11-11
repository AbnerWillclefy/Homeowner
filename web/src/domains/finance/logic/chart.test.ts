import { describe, expect, it } from "vitest";
import { arcPath, barPercent, donutParts, linePoints, scaleMax } from "./chart";

describe("barPercent", () => {
  it("is 0 at zero, 50 at half, 100 at the maximum", () => {
    expect(barPercent(0, 200)).toBe(0);
    expect(barPercent(100, 200)).toBe(50);
    expect(barPercent(200, 200)).toBe(100);
  });
  it("clamps above the maximum and below zero", () => {
    expect(barPercent(500, 200)).toBe(100);
    expect(barPercent(-40, 200)).toBe(0);
  });
  it("is 0 when the maximum is 0 or less", () => {
    expect(barPercent(10, 0)).toBe(0);
    expect(barPercent(10, -5)).toBe(0);
  });
});

describe("scaleMax", () => {
  it("takes the largest of the values and the markers, never below 0", () => {
    expect(scaleMax([100, 300], [450])).toBe(450);
    expect(scaleMax([100, 300], [])).toBe(300);
    expect(scaleMax([-5], [])).toBe(0);
    expect(scaleMax([], [])).toBe(0);
  });
});

describe("linePoints", () => {
  it("places a shorter series on the shared day scale", () => {
    expect(linePoints([0, 50, 100], 100, 100, 40, 5)).toBe("0,40 25,20 50,0");
  });
  it("spans the width and puts the maximum at the top", () => {
    expect(linePoints([0, 50, 100], 100, 100, 40)).toBe("0,40 50,20 100,0");
  });
  it("draws a flat line across the width for a single day", () => {
    expect(linePoints([50], 100, 100, 40)).toBe("0,20 100,20");
    expect(linePoints([50], 100, 100, 40, 5)).toBe("0,20 25,20");
  });
  it("draws all zeros along the bottom, even with a maximum of 0", () => {
    expect(linePoints([0, 0], 0, 100, 40)).toBe("0,40 100,40");
  });
  it("gives one point per day for a month of 31", () => {
    const points = linePoints(Array.from({ length: 31 }, (_, i) => i), 30, 100, 40).split(" ");
    expect(points).toHaveLength(31);
    expect(points[0]).toBe("0,40");
    expect(points[30]).toBe("100,0");
  });
});

describe("donutParts", () => {
  it("covers the full circle, clockwise from the top, in the order given", () => {
    const parts = donutParts([50, 30, 20]);
    expect(parts.map((p) => [p.start, p.end])).toEqual([[0, 180], [180, 288], [288, 360]]);
    expect(parts.map((p) => p.index)).toEqual([0, 1, 2]);
  });
  it("is one full ring for one value", () => {
    expect(donutParts([1234])).toEqual([{ index: 0, start: 0, end: 360, percent: 100 }]);
  });
  it("leaves out zero and negative values but keeps the index of the rest", () => {
    expect(donutParts([0, 40, -10, 60]).map((p) => p.index)).toEqual([1, 3]);
    expect(donutParts([0, -5])).toEqual([]);
    expect(donutParts([])).toEqual([]);
  });
  it("rounds the shares once, so they are whole numbers that add up to 100", () => {
    for (const values of [[1, 1, 1], [333, 333, 334], [1, 2, 3, 4, 5, 6, 7], [99999, 1]]) {
      const percents = donutParts(values).map((p) => p.percent);
      expect(percents.every(Number.isInteger)).toBe(true);
      expect(percents.reduce((a, b) => a + b, 0)).toBe(100);
    }
  });
});

describe("arcPath", () => {
  it("draws a part as one outer arc and one inner arc", () => {
    const d = arcPath(50, 50, 40, 30, 0, 90);
    expect(d.match(/A/g)).toHaveLength(2);
    expect(d.startsWith("M50 10")).toBe(true);
  });
  it("flags a sweep over half the circle as the large arc", () => {
    expect(arcPath(50, 50, 40, 30, 0, 200)).toContain("A40 40 0 1 1");
    expect(arcPath(50, 50, 40, 30, 0, 90)).toContain("A40 40 0 0 1");
  });
  it("draws a full ring as two circles", () => {
    expect(arcPath(50, 50, 40, 30, 0, 360).match(/A/g)).toHaveLength(4);
  });
});
