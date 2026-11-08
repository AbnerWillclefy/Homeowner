import { describe, expect, it } from "vitest";
import type { Bill } from "../api/api";
import { billGroups } from "./billGroups";

const bill = (id: string, dueDate: string, expectedCents: number, over: Partial<Bill> = {}): Bill => ({
  id,
  name: id,
  expectedCents,
  dueDay: Number(dueDate.slice(8)),
  dueDate,
  paid: false,
  paidBy: null,
  ...over,
});

describe("billGroups", () => {
  const bills = [
    bill("luz", "2030-01-20", 21050),
    bill("aluguel", "2030-01-05", 150000),
    bill("agua", "2030-01-12", 6000, { paid: true, paidBy: "hand" }),
    bill("net", "2030-01-10", 9990, { paid: true, paidBy: "bank" }),
    bill("gas", "2030-01-15", 4000),
    bill("tv", "2030-01-02", 3000),
  ];
  const groups = billGroups(bills, "2030-01-15");

  it("puts overdue, due and paid Bills in their own group, a bank-paid Bill among the paid, each by due date", () => {
    expect(groups.overdue.bills.map((b) => b.id)).toEqual(["tv", "aluguel"]);
    expect(groups.due.bills.map((b) => b.id)).toEqual(["gas", "luz"]);
    expect(groups.paid.bills.map((b) => b.id)).toEqual(["net", "agua"]);
  });

  it("totals each group", () => {
    expect(groups.overdue.totalCents).toBe(153000);
    expect(groups.due.totalCents).toBe(25050);
    expect(groups.paid.totalCents).toBe(15990);
  });

  it("derives the summary from the groups so paid and still to pay agree with them", () => {
    expect(groups.paidCents).toBe(15990);
    expect(groups.toPayCents).toBe(178050);
  });

  it("leaves a group empty when no Bill is in it", () => {
    const none = billGroups([], "2030-01-15");
    expect(none.overdue).toEqual({ bills: [], totalCents: 0 });
    expect(none.toPayCents).toBe(0);
  });
});
