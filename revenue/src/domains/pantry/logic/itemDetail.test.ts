import { describe, expect, it } from "vitest";
import type { ItemDetail } from "../api";
import { chartPoints, daysCopy, detailView, lowestPoint } from "./itemDetail";

const ITEM = { id: "p1", name: "Arroz", preferredBrand: null, fixed: false, state: "in_stock", ranOutOn: null } as const;
const price = (issuedOn: string, unitPriceCents: number, storeName = "Bom Preço") => ({ issuedOn, unitPriceCents, storeName });
const detail = (over: Partial<ItemDetail>): ItemDetail => ({ item: ITEM, avgDurationDays: null, prices: [], ...over });

describe("chartPoints", () => {
  it("puts the oldest purchase first, whatever order the API sent", () => {
    const newestFirst = [price("2030-01-02", 2790), price("2029-12-01", 2400), price("2029-06-10", 2600)];
    expect(chartPoints(newestFirst).map((p) => p.day)).toEqual(["2029-06-10", "2029-12-01", "2030-01-02"]);
    expect(chartPoints([...newestFirst].reverse()).map((p) => p.day)).toEqual(["2029-06-10", "2029-12-01", "2030-01-02"]);
  });

  it("keeps each point's price and store", () => {
    expect(chartPoints([price("2030-01-02", 2790, "Atacadão")])).toEqual([{ day: "2030-01-02", cents: 2790, store: "Atacadão" }]);
  });
});

describe("lowestPoint", () => {
  it("finds the cheapest purchase, the latest on a tie, and none for no purchases", () => {
    const points = chartPoints([price("2030-01-02", 2400), price("2029-12-01", 2400), price("2029-06-10", 2900)]);
    expect(lowestPoint(points)?.day).toBe("2030-01-02");
    expect(lowestPoint([])).toBeUndefined();
  });
});

describe("detailView", () => {
  it("is empty for an item never bought, even with an average", () => {
    expect(detailView(detail({}))).toEqual({ kind: "empty" });
  });

  it("has no cycle when bought but never finished, and a cycle once an average exists", () => {
    const prices = [price("2030-01-02", 2790)];
    expect(detailView(detail({ prices }))).toMatchObject({ kind: "ready", avgDays: null });
    expect(detailView(detail({ prices, avgDurationDays: 22 }))).toMatchObject({ kind: "ready", avgDays: 22 });
  });

  it("takes the last price from the newest purchase", () => {
    const view = detailView(detail({ prices: [price("2030-01-02", 2790), price("2029-12-01", 2400)] }));
    expect(view).toMatchObject({ last: { cents: 2790 }, lowest: { cents: 2400 } });
  });
});

describe("daysCopy", () => {
  it.each([[1, "pantry.item.days.one"], [2, "pantry.item.days.many"], [22, "pantry.item.days.many"], [0, "pantry.item.days.many"]])("%i days uses %s", (n, key) => {
    expect(daysCopy(n)).toEqual({ key, count: n });
  });
});
