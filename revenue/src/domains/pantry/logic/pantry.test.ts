import { describe, expect, it } from "vitest";
import type { PantryItem } from "../api";
import { daysBetween, groupItems, itemFormOf, withRanOut } from "./pantry";

const item = (over: Partial<PantryItem>): PantryItem => ({ id: over.name ?? "x", name: "Arroz", preferredBrand: null, fixed: false, state: "in_stock", ranOutOn: null, ...over });

describe("groupItems", () => {
  it("puts the item that ran out last first, and orders the rest by name", () => {
    const { out, stock } = groupItems([
      item({ name: "Café", state: "ran_out", ranOutOn: "2030-01-05" }),
      item({ name: "Leite", state: "ran_out", ranOutOn: "2030-01-08" }),
      item({ name: "Azeite" }),
      item({ name: "Arroz" }),
      item({ name: "Abacate" }),
    ]);
    expect(out.map((i) => i.name)).toEqual(["Leite", "Café"]);
    expect(stock.map((i) => i.name)).toEqual(["Abacate", "Arroz", "Azeite"]);
  });
});

describe("withRanOut", () => {
  it("marks the day, and takes it off", () => {
    const marked = withRanOut(item({}), true, "2030-01-10");
    expect(marked).toMatchObject({ state: "ran_out", ranOutOn: "2030-01-10" });
    expect(withRanOut(marked, false, "2030-01-10")).toMatchObject({ state: "in_stock", ranOutOn: null });
  });
});

describe("daysBetween", () => {
  it("counts calendar days across a month end and a leap day, never below zero", () => {
    expect(daysBetween("2030-01-08", "2030-01-10")).toBe(2);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2030-01-10", "2030-01-10")).toBe(0);
    expect(daysBetween("2030-01-11", "2030-01-10")).toBe(0);
  });
});

describe("itemFormOf", () => {
  it("trims, and reads an empty brand as none", () => {
    expect(itemFormOf({ name: "  Arroz ", brand: "  " })).toEqual({ ok: true, name: "Arroz", brand: null });
    expect(itemFormOf({ name: "Arroz", brand: " Tio João" })).toEqual({ ok: true, name: "Arroz", brand: "Tio João" });
  });

  it("refuses an empty name and a name or brand over 60 letters, counting letters not bytes", () => {
    expect(itemFormOf({ name: " ", brand: "" })).toEqual({ ok: false, errors: { name: "required" } });
    expect(itemFormOf({ name: "ç".repeat(61), brand: "" })).toEqual({ ok: false, errors: { name: "too_long" } });
    expect(itemFormOf({ name: "ç".repeat(60), brand: "" }).ok).toBe(true);
    expect(itemFormOf({ name: "a", brand: "b".repeat(61) })).toEqual({ ok: false, errors: { preferredBrand: "too_long" } });
  });
});
