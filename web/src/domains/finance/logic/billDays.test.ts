import { describe, expect, it } from "vitest";
import { readBillDays } from "./billDays";

describe("readBillDays", () => {
  it("clears when both are empty", () => {
    expect(readBillDays("", "  ")).toEqual({ ok: true, closeDay: null, dueDay: null });
  });
  it("saves both valid days, trimmed, at each end of the range", () => {
    expect(readBillDays(" 7 ", "12")).toEqual({ ok: true, closeDay: 7, dueDay: 12 });
    expect(readBillDays("1", "31")).toEqual({ ok: true, closeDay: 1, dueDay: 31 });
  });
  it("asks for the empty one when only one is typed", () => {
    expect(readBillDays("7", "")).toEqual({ ok: false, errors: { dueDay: "required" } });
    expect(readBillDays(" ", "12")).toEqual({ ok: false, errors: { closeDay: "required" } });
  });
  it("calls out of range and junk invalid", () => {
    expect(readBillDays("0", "32")).toEqual({ ok: false, errors: { closeDay: "invalid", dueDay: "invalid" } });
    expect(readBillDays("7a", "1.5")).toEqual({ ok: false, errors: { closeDay: "invalid", dueDay: "invalid" } });
    expect(readBillDays("7 7", "-3")).toEqual({ ok: false, errors: { closeDay: "invalid", dueDay: "invalid" } });
  });
  it("reports a junk day next to an empty one", () => {
    expect(readBillDays("40", "")).toEqual({ ok: false, errors: { closeDay: "invalid", dueDay: "required" } });
  });
});
