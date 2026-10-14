import { describe, expect, it } from "vitest";
import { INTERVAL_PRESETS, intervalForPreset, presetFor, presetForText } from "./intervalPresets";

describe("presetFor", () => {
  it("matches the days of each preset exactly", () => {
    expect([1, 7, 14, 30].map(presetFor)).toEqual(["daily", "weekly", "every_2_weeks", "monthly"]);
  });

  it("is custom for a one-off and for any other number of days", () => {
    for (const days of [null, 2, 10, 28, 31, 0, -7, 365]) expect(presetFor(days)).toBe("custom");
  });
});

describe("intervalForPreset", () => {
  it("gives the days of each named preset and none for custom", () => {
    expect(INTERVAL_PRESETS.map(intervalForPreset)).toEqual([1, 7, 14, 30]);
    expect(intervalForPreset("custom")).toBeNull();
  });

  it("round-trips both ways", () => {
    for (const days of [1, 7, 14, 30]) expect(intervalForPreset(presetFor(days))).toBe(days);
    for (const preset of INTERVAL_PRESETS) expect(presetFor(intervalForPreset(preset))).toBe(preset);
  });
});

describe("presetForText", () => {
  it("reads the form's text: blank and odd text are custom", () => {
    expect(["7", " 14 ", "30", "1"].map(presetForText)).toEqual(["weekly", "every_2_weeks", "monthly", "daily"]);
    for (const text of ["", "  ", "10", "abc", "7.5", "-7"]) expect(presetForText(text)).toBe("custom");
  });
});
