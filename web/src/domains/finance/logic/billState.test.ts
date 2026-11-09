import { describe, expect, it } from "vitest";
import { billState } from "./billState";

const bill = (over: Partial<{ paid: boolean; paidBy: "hand" | "bank" | null; dueDate: string }>) => ({
  paid: false,
  paidBy: null,
  dueDate: "2026-11-10",
  ...over,
});

describe("billState", () => {
  it("is paid-bank for a Bill the bank paid", () => {
    expect(billState(bill({ paid: true, paidBy: "bank" }), "2026-11-20")).toBe("paid-bank");
  });
  it("is paid-hand for a Bill marked by hand, even past its due date", () => {
    expect(billState(bill({ paid: true, paidBy: "hand" }), "2026-11-20")).toBe("paid-hand");
  });
  it("is paid-hand when paid is set and the payer is not sent", () => {
    expect(billState(bill({ paid: true }), "2026-11-01")).toBe("paid-hand");
  });
  it("is due up to and on the due date", () => {
    expect(billState(bill({}), "2026-11-09")).toBe("due");
    expect(billState(bill({}), "2026-11-10")).toBe("due");
  });
  it("is overdue the day after", () => {
    expect(billState(bill({}), "2026-11-11")).toBe("overdue");
  });
  it("is never overdue when today is null", () => {
    expect(billState(bill({ dueDate: "2000-01-01" }), null)).toBe("due");
  });
});
