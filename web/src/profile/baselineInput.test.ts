import { describe, expect, it } from "vitest";
import { MAX_BASELINE, parseBaselineInput } from "./baselineInput";

describe("parseBaselineInput", () => {
  it("clears the day when the field is empty or only spaces", () => {
    expect(parseBaselineInput("")).toEqual({ kind: "clear" });
    expect(parseBaselineInput("   ")).toEqual({ kind: "clear" });
  });

  it("keeps 0 as a real value, not as a clear", () => {
    expect(parseBaselineInput("0")).toEqual({ kind: "set", points: 0 });
  });

  it("sets whole numbers up to the maximum", () => {
    expect(parseBaselineInput("7")).toEqual({ kind: "set", points: 7 });
    expect(parseBaselineInput(" 12 ")).toEqual({ kind: "set", points: 12 });
    expect(parseBaselineInput(String(MAX_BASELINE))).toEqual({ kind: "set", points: MAX_BASELINE });
  });

  it("rejects negatives, fractions, words and numbers over the maximum before anything is sent", () => {
    for (const raw of ["-1", "2.5", "1e1", "abc", "3x", String(MAX_BASELINE + 1), "99999999999999999999"]) {
      expect(parseBaselineInput(raw), raw).toEqual({ kind: "invalid" });
    }
  });
});
