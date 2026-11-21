import { describe, expect, it } from "vitest";
import { paceView } from "./pace";

describe("paceView", () => {
  it("numbers the days from 1 and finds the distance under the line", () => {
    // Day 3 of 11: the line is at 1000 * 2 / 10 = 200.
    const view = paceView({ spentCents: [10, 50, 150], lineEndCents: 1000 }, 11);
    expect(view.points).toEqual([{ day: 1, cents: 10 }, { day: 2, cents: 50 }, { day: 3, cents: 150 }]);
    expect(view).toMatchObject({ over: false, gapCents: 50 });
  });
  it("is over only strictly above the line", () => {
    expect(paceView({ spentCents: [0, 0, 200], lineEndCents: 1000 }, 11)).toMatchObject({ over: false, gapCents: 0 });
    expect(paceView({ spentCents: [0, 0, 201], lineEndCents: 1000 }, 11)).toMatchObject({ over: true, gapCents: 1 });
  });
  it("rounds the line to a whole cent", () => {
    // Day 2 of 4: 100 / 3 = 33.33
    expect(paceView({ spentCents: [0, 30], lineEndCents: 100 }, 4).gapCents).toBe(3);
  });
  it("has no gap before the first day is known", () => {
    expect(paceView({ spentCents: [], lineEndCents: 100 }, 30)).toMatchObject({ points: [], gapCents: 0, over: false });
  });
});
