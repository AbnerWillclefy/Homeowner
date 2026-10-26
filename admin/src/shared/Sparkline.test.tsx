import { describe, expect, it } from "vitest";
import { mount } from "../testing";
import { sparklinePaths, Sparkline } from "./Sparkline";

const { render, container } = mount();

describe("sparklinePaths", () => {
  it("scales a series between the baseline and the top", () => {
    const [segment] = sparklinePaths([0, 5, 10], 100, 20);
    expect(segment).toEqual([[0, 20], [50, 10], [100, 0]]);
  });
  it("puts an all-zero series on the baseline, never dividing by zero", () => {
    const [segment] = sparklinePaths([0, 0, 0], 100, 20);
    expect(segment!.every(([x, y]) => Number.isFinite(x) && y === 20)).toBe(true);
  });
  it("splits at null", () => {
    const segments = sparklinePaths([1, null, 2, 3], 90, 10);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(1);
    expect(segments[1]).toHaveLength(2);
  });
  it("is empty when every value is null or there are no values", () => {
    expect(sparklinePaths([null, null], 100, 20)).toEqual([]);
    expect(sparklinePaths([], 100, 20)).toEqual([]);
  });
  it("centres a single point", () => {
    expect(sparklinePaths([4], 100, 20)).toEqual([[[50, 0]]]);
  });
});

describe("Sparkline", () => {
  it("is an image with the label as its text alternative, and draws a polyline", async () => {
    await render(<Sparkline values={[1, 3, 2]} label="Fallbacks per day: 1 to 2, highest 3" />);
    const svg = container().querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Fallbacks per day: 1 to 2, highest 3");
    expect(svg.getAttribute("viewBox")).not.toBeNull();
    const line = svg.querySelector("polyline")!;
    expect(line.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    expect(line.getAttribute("stroke")).toBe("currentColor");
  });

  it("draws a flat line for all zeros, with no NaN anywhere", async () => {
    await render(<Sparkline values={[0, 0, 0, 0]} label="flat" />);
    expect(container().innerHTML).not.toContain("NaN");
    expect(container().querySelectorAll("polyline")).toHaveLength(1);
  });

  it("draws a dot for a single point", async () => {
    await render(<Sparkline values={[3]} label="one" />);
    expect(container().querySelector("circle")).not.toBeNull();
    expect(container().innerHTML).not.toContain("NaN");
  });

  it("breaks the line into segments at null", async () => {
    await render(<Sparkline values={[1, 2, null, 3, 4]} label="gap" />);
    expect(container().querySelectorAll("polyline")).toHaveLength(2);
  });

  it("draws only the baseline when there is nothing to plot", async () => {
    await render(<Sparkline values={[null, null]} label="none" />);
    expect(container().querySelectorAll("polyline")).toHaveLength(0);
    expect(container().querySelector("line")).not.toBeNull();
  });
});
