import { describe, expect, it } from "vitest";
import { barPercent, linePoints, scaleMax } from "./chart";

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
