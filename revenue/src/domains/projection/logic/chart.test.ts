import { describe, expect, it } from "vitest";
import { chartLayout } from "./chart";

describe("chartLayout", () => {
  it("grows a positive bar up from the baseline and a negative one down, on one scale", () => {
    const { bars, rows, empty } = chartLayout([300, -100, 150]);
    expect(rows).toBe("300fr 100fr");
    expect(bars).toEqual([{ up: 100, down: null }, { up: null, down: 100 }, { up: 50, down: null }]);
    expect(empty).toBe(false);
  });

  it("gives the whole plot to the part above when no month is negative", () => {
    expect(chartLayout([10, 0]).rows).toBe("10fr 0fr");
    expect(chartLayout([10, 0]).bars[1]).toEqual({ up: 0, down: null });
  });

  it("keeps all-zero values finite, with a baseline", () => {
    const { bars, rows, empty } = chartLayout([0, 0]);
    expect(bars).toEqual([{ up: 0, down: null }, { up: 0, down: null }]);
    expect(rows).toBe("1fr 0fr");
    expect(empty).toBe(true);
  });

  it("keeps all-negative values on the lower part", () => {
    const { bars, rows } = chartLayout([-50, -100]);
    expect(rows).toBe("0fr 100fr");
    expect(bars.map((b) => b.down)).toEqual([50, 100]);
  });
});
