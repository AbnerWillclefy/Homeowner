import { describe, expect, it } from "vitest";
import type { Investment } from "../api";
import { goalFieldErrorKey } from "./savings";
import { groupInvestments, investmentInputOf } from "./investments";

const inv = (over: Partial<Investment>): Investment => ({
  id: "i", name: "CDB", valueCents: 100, serves: "reserve", source: "hand", reportedByBank: true, edited: false, bankValueCents: null, ...over,
});

describe("investmentInputOf", () => {
  it("trims the name and takes a zero value", () =>
    expect(investmentInputOf({ name: " CDB ", cents: 0, serves: "goals" })).toEqual({ ok: true, input: { name: "CDB", valueCents: 0, serves: "goals" } }));
  it("names every field that is wrong", () =>
    expect(investmentInputOf({ name: " ", cents: null, serves: null })).toEqual({ ok: false, errors: { name: "required", valueCents: "invalid", serves: "invalid" } }));
  it("refuses a name over 60 characters", () =>
    expect(investmentInputOf({ name: "a".repeat(61), cents: 1, serves: "reserve" })).toMatchObject({ ok: false, errors: { name: "too_long" } }));
});

describe("groupInvestments", () => {
  it("splits by what they serve, keeps the order and leaves empty groups out", () => {
    const rows = [inv({ id: "a", serves: "goals" }), inv({ id: "b", serves: null, source: "pluggy" }), inv({ id: "c", serves: "goals" })];
    expect(groupInvestments(rows).map((g) => [g.serves, g.items.map((i) => i.id)])).toEqual([["goals", ["a", "c"]], ["none", ["b"]]]);
    expect(groupInvestments([])).toEqual([]);
  });
});

describe("field errors", () => {
  it("know the Investment's value and serves", () => {
    expect(goalFieldErrorKey("valueCents", "invalid")).toBe("investments.field.value.invalid");
    expect(goalFieldErrorKey("serves", "invalid")).toBe("investments.field.serves.invalid");
  });
});
