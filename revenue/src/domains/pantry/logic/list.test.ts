import { describe, expect, it } from "vitest";
import type { ShoppingList } from "../api";
import { overBy, pruneChecked, quantityLabel, stepFor, unpricedCount, withQuantity, withoutItem } from "./list";

const row = (over: Partial<ShoppingList["items"][number]> = {}): ShoppingList["items"][number] => ({
  itemId: "p1", name: "Arroz", preferredBrand: null, fixed: false, quantityMilli: 1000, unit: "UN", ...over,
});

describe("overBy", () => {
  it.each([
    ["under", 5000, 8000, null],
    ["equal", 8000, 8000, null],
    ["over", 8000, 5000, 3000],
    ["left already negative", 2000, -1500, 3500],
    ["no limit", 8000, undefined, null],
  ])("%s", (_name, total, left, expected) => {
    expect(overBy(total, left)).toBe(expected);
  });
});

describe("stepFor", () => {
  it("steps a unit item by one and a kilogram item by 0,1 kg, each with that minimum", () => {
    expect(stepFor("UN")).toEqual({ step: 1000, min: 1000 });
    expect(stepFor("KG")).toEqual({ step: 100, min: 100 });
  });

  it("treats a unit it does not know as a count", () => {
    expect(stepFor("CX")).toEqual({ step: 1000, min: 1000 });
  });
});

describe("quantityLabel", () => {
  it("shows a count plain and a weight with three decimals and its unit", () => {
    expect(quantityLabel(2000, "UN", "pt-BR")).toBe("2");
    expect(quantityLabel(450, "KG", "pt-BR")).toBe("0,450 kg");
    expect(quantityLabel(1234, "KG", "en-US")).toBe("1.234 kg");
  });
});

describe("pruneChecked", () => {
  it("keeps only ticks of items still on the list", () => {
    expect(pruneChecked(["p1", "gone", "p2"], [row(), row({ itemId: "p2" })])).toEqual(["p1", "p2"]);
    expect(pruneChecked(["gone"], [])).toEqual([]);
  });
});

describe("unpricedCount", () => {
  it("counts the items with no price", () => {
    expect(unpricedCount([row({ priceCents: 100 }), row({ itemId: "p2" }), row({ itemId: "p3" })])).toBe(2);
  });
});

describe("withQuantity and withoutItem", () => {
  const list: ShoppingList = {
    items: [row({ unitPriceCents: 800, priceCents: 800 }), row({ itemId: "p2", unit: "KG", quantityMilli: 500, unitPriceCents: 6000, priceCents: 3000 }), row({ itemId: "p3" })],
    expectedTotalCents: 3800,
    groceriesLeftCents: 9000,
  };

  it("reprices the line and moves the total by the difference", () => {
    const next = withQuantity(list, "p2", 1500);
    expect(next.items[1]).toMatchObject({ quantityMilli: 1500, priceCents: 9000 });
    expect(next.expectedTotalCents).toBe(9800);
    expect(next.groceriesLeftCents).toBe(9000);
  });

  it("changes the quantity of an unpriced line without touching the total", () => {
    const next = withQuantity(list, "p3", 3000);
    expect(next.items[2]!.quantityMilli).toBe(3000);
    expect(next.items[2]!.priceCents).toBeUndefined();
    expect(next.expectedTotalCents).toBe(3800);
  });

  it("takes a line and its price out", () => {
    expect(withoutItem(list, "p2")).toMatchObject({ expectedTotalCents: 800, items: [{ itemId: "p1" }, { itemId: "p3" }] });
  });

  it("leaves the list as it was for an id it does not hold", () => {
    expect(withQuantity(list, "nope", 5000)).toEqual(list);
    expect(withoutItem(list, "nope")).toEqual(list);
  });
});
