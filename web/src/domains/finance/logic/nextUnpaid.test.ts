import { describe, expect, it } from "vitest";
import type { Bill } from "../api/api";
import { nextUnpaid } from "./nextUnpaid";

const bill = (id: string, dueDate: string, paid = false, paidBy: "hand" | "bank" | null = paid ? "hand" : null): Bill =>
  ({ id, name: id, expectedCents: 1000, dueDay: Number(dueDate.slice(8)), dueDate, paid, paidBy }) as Bill;

describe("nextUnpaid", () => {
  const today = "2026-11-08";

  it("takes the nearest by due date, overdue first, and skips paid ones", () => {
    const bills = [bill("c", "2026-11-20"), bill("p", "2026-11-01", true), bill("a", "2026-11-03"), bill("d", "2026-11-25"), bill("b", "2026-11-10"), bill("k", "2026-11-02", true, "bank")];
    expect(nextUnpaid(bills, today, 3).map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("returns fewer when fewer are unpaid, and none when all are paid", () => {
    expect(nextUnpaid([bill("a", "2026-11-10")], today, 3)).toHaveLength(1);
    expect(nextUnpaid([bill("a", "2026-11-10", true)], today, 3)).toEqual([]);
    expect(nextUnpaid([], today, 3)).toEqual([]);
  });
});
