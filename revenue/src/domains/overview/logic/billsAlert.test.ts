import { describe, expect, it } from "vitest";
import type { Bill } from "../../bills/api";
import { billsAlert } from "./billsAlert";

const bill = (id: string, dueDate: string, paid = false, expectedCents = 10000): Bill => ({ id, name: id, expectedCents, dueDay: Number(dueDate.slice(8)), dueDate, paid, paidBy: null, paidCents: null });

describe("billsAlert", () => {
  const bills = [bill("c", "2026-11-25"), bill("a", "2026-11-15"), bill("p", "2026-11-05", true), bill("b", "2026-11-20", false, 5000)];

  it("lists the unpaid Bills in due order with their total and the first due date", () => {
    const alert = billsAlert(bills, "2026-11-13");
    expect(alert.unpaid.map((b) => b.id)).toEqual(["a", "b", "c"]);
    expect(alert).toMatchObject({ totalCents: 25000, firstDue: "2026-11-15", daysToFirst: 2, lastDue: "2026-11-25" });
  });

  it("counts a past due date as negative days", () => {
    expect(billsAlert([bill("a", "2026-11-10")], "2026-11-13").daysToFirst).toBe(-3);
  });

  it("has no days in a past month, where there is no today", () => {
    expect(billsAlert(bills, null).daysToFirst).toBeNull();
  });

  it("is empty when everything is paid", () => {
    expect(billsAlert([bill("p", "2026-11-05", true)], "2026-11-13")).toMatchObject({ unpaid: [], totalCents: 0, firstDue: null, daysToFirst: null, lastDue: null });
  });
});
