import { describe, expect, it } from "vitest";
import { chartLayout, PLOT_HEIGHT, PLOT_TOP } from "./chart";

describe("chartLayout", () => {
  it("grows a positive bar up from the baseline and a negative one down", () => {
    const { bars, baseline, top, bottom } = chartLayout([300, -100]);
    expect([top, bottom]).toEqual([300, -100]);
    expect(baseline).toBe(PLOT_TOP + (PLOT_HEIGHT * 3) / 4);
    expect(bars[0]!.y + bars[0]!.h).toBe(baseline);
    expect(bars[1]!.y).toBe(baseline);
    expect(bars.map((b) => b.negative)).toEqual([false, true]);
  });

  it("keeps all-zero values finite", () => {
    const { bars } = chartLayout([0, 0]);
    expect(bars.every((b) => Number.isFinite(b.y) && b.h === 2)).toBe(true);
  });
});
