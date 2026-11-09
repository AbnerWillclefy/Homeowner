import { describe, expect, it } from "vitest";
import type { Bill } from "../api/api";
import { dueStrip } from "./dueStrip";

const bill = (id: string, dueDate: string): Bill => ({ id, name: id, expectedCents: 100, dueDay: Number(dueDate.slice(8)), dueDate, paid: false, paidCents: null });

describe("dueStrip", () => {
  it("has one cell per day of the month, a leap February included", () => {
    expect(dueStrip([], "2032-02", "2032-02-10").days).toHaveLength(29);
    expect(dueStrip([], "2030-02", "2030-02-10").days).toHaveLength(28);
    expect(dueStrip([], "2030-01", "2030-01-10").days).toHaveLength(31);
  });

  it("puts each Bill on its due day, two Bills on one day together", () => {
    const strip = dueStrip([bill("a", "2030-01-05"), bill("b", "2030-01-05"), bill("c", "2030-01-31")], "2030-01", "2030-01-15");
    expect(strip.days[4]).toEqual({ day: 5, bills: [bill("a", "2030-01-05"), bill("b", "2030-01-05")] });
    expect(strip.days[30]!.bills.map((b) => b.id)).toEqual(["c"]);
    expect(strip.days[0]).toEqual({ day: 1, bills: [] });
  });

  it("marks today's day, or none when today is in another month", () => {
    expect(dueStrip([], "2030-01", "2030-01-15").today).toBe(15);
    expect(dueStrip([], "2030-01", "2030-02-01").today).toBeNull();
  });

  it("marks no day when today is null, as for a past month", () => {
    expect(dueStrip([], "2030-01", null).today).toBeNull();
  });
});
