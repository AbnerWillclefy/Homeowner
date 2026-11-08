import { describe, expect, it } from "vitest";
import type { Transaction } from "../api/api";
import { paceSeries } from "./paceSeries";

const tx = (postedOn: string, amountCents: number, type: Transaction["type"] = "expense"): Transaction => ({
  id: postedOn + amountCents, postedOn, description: "x", sourceName: "Nubank", amountCents, currency: "BRL",
  type, spendingCategory: type === "expense" ? "groceries" : null, categorySetBy: "auto",
});
const on = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("paceSeries", () => {
  it("is cumulative per day, this month up to today and last month for all its days", () => {
    const r = paceSeries([tx("2026-11-02", -1000), tx("2026-11-02", -500), tx("2026-11-04", -250)], [tx("2026-10-01", -100), tx("2026-10-31", -900)], "2026-11", on(2026, 11, 4));
    expect(r.current).toEqual([0, 1500, 1500, 1750]);
    expect(r.previous).toHaveLength(31);
    expect(r.previous[0]).toBe(100);
    expect(r.previous[29]).toBe(100);
    expect(r.previous[30]).toBe(1000);
  });

  it("on day 1 is one point, with zeros while nothing has posted yet", () => {
    expect(paceSeries([], [], "2026-11", on(2026, 11, 1)).current).toEqual([0]);
  });

  it("on day 31 against a 30-day month, this month has 31 points and last month 30", () => {
    const r = paceSeries([tx("2026-10-31", -700)], [tx("2026-09-30", -300)], "2026-10", on(2026, 10, 31));
    expect(r.current).toHaveLength(31);
    expect(r.current[30]).toBe(700);
    expect(r.previous).toHaveLength(30);
    expect(r.previous[29]).toBe(300);
  });

  it("nets a refund off, and leaves transfers and income out", () => {
    const r = paceSeries([tx("2026-11-01", -1000), tx("2026-11-02", 400), tx("2026-11-02", -5000, "transfer"), tx("2026-11-02", 9000, "income")], [], "2026-11", on(2026, 11, 3));
    expect(r.current).toEqual([1000, 600, 600]);
  });

  it("ends where sameDays does: this month's total, and last month's up to the same day", () => {
    const r = paceSeries([tx("2026-11-03", -800)], [tx("2026-10-02", -100), tx("2026-10-20", -900)], "2026-11", on(2026, 11, 3));
    expect(r.current.at(-1)).toBe(800);
    expect(r.previous[2]).toBe(100); // day 3 of October, the cut
  });
});
