import { describe, expect, it } from "vitest";
import type { Bill } from "../api";
import { billInputOf, billFieldErrorKey, readDay } from "./billForm";
import { billState, filterBills, summarise, withPaid } from "./billState";

const bill = (over: Partial<Bill> = {}): Bill => ({
  id: "b1", name: "Aluguel", expectedCents: 100000, dueDay: 5, dueDate: "2030-01-05", paid: false, paidBy: null, paidCents: null, ...over,
});

describe("billState", () => {
  it("tells paid by bank, paid by hand, due and overdue", () => {
    expect(billState(bill({ paid: true, paidBy: "bank" }), "2030-01-10")).toBe("paid-bank");
    expect(billState(bill({ paid: true, paidBy: "hand" }), "2030-01-10")).toBe("paid-hand");
    expect(billState(bill(), "2030-01-05")).toBe("due");
    expect(billState(bill(), "2030-01-06")).toBe("overdue");
  });
  it("calls nothing overdue in a past month", () => expect(billState(bill(), null)).toBe("due"));
});

describe("summarise and withPaid", () => {
  it("adds paid (what was paid) against still to pay (what is expected)", () => {
    const s = summarise([bill({ paid: true, paidBy: "hand", paidCents: 90000 }), bill({ id: "b2", expectedCents: 5000 }), bill({ id: "b3", paid: true, paidBy: "bank", paidCents: null })]);
    expect(s).toEqual({ paidCents: 190000, toPayCents: 5000, toPayCount: 1 });
  });
  it("marks by hand and undoes", () => {
    expect(withPaid(bill(), true)).toMatchObject({ paid: true, paidBy: "hand", paidCents: 100000 });
    expect(withPaid(withPaid(bill(), true), false)).toEqual(bill());
  });
});

describe("billInputOf", () => {
  const ok = { name: " Aluguel ", cents: 123456, dueDay: "5" };
  it("trims and reads the fields", () => expect(billInputOf(ok)).toEqual({ ok: true, input: { name: "Aluguel", expectedCents: 123456, dueDay: 5 } }));
  it("names each field that is wrong, with the API's codes", () => {
    expect(billInputOf({ name: " ", cents: null, dueDay: "" })).toEqual({ ok: false, errors: { name: "required", expectedCents: "invalid", dueDay: "invalid" } });
    expect(billInputOf({ ...ok, name: "x".repeat(61) })).toEqual({ ok: false, errors: { name: "too_long" } });
    expect(billInputOf({ ...ok, cents: 0 })).toEqual({ ok: false, errors: { expectedCents: "invalid" } });
    expect(billInputOf({ ...ok, dueDay: "32" })).toEqual({ ok: false, errors: { dueDay: "invalid" } });
  });
  it("reads days only as whole numbers from 1 to 31", () => {
    expect([readDay("1"), readDay("31"), readDay("0"), readDay("1.5"), readDay("abc")]).toEqual([1, 31, null, null, null]);
  });
  it("gives an unknown code a message", () => {
    expect(billFieldErrorKey("name", "required")).toBe("bills.field.name.required");
    expect(billFieldErrorKey("name", "new_code")).toBe("bills.field.unknown");
  });
});

describe("filterBills", () => {
  const rows = [bill({ id: "a" }), bill({ id: "b", paid: true, paidBy: "hand" }), bill({ id: "c", paid: true, paidBy: "bank" }), bill({ id: "d", dueDate: "2030-01-30" })];
  const ids = (f: "all" | "pending" | "paid") => filterBills(rows, f, "2030-01-10").map((b) => b.id);
  it("keeps all, the unpaid, or the paid by hand or bank", () => {
    expect(ids("all")).toEqual(["a", "b", "c", "d"]);
    expect(ids("pending")).toEqual(["a", "d"]);
    expect(ids("paid")).toEqual(["b", "c"]);
  });
});
