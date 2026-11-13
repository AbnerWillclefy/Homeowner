import { describe, expect, it } from "vitest";
import type { CardTransaction } from "../api";
import { readBillDays } from "./billDays";
import { billRows, rowsTotal } from "./cardBill";

const row = (over: Partial<CardTransaction>): CardTransaction => ({ id: "t1", sourceId: "s1", description: "x", postedOn: "2030-01-02", countsOn: "2030-02-05", amountCents: -1000, installment: null, ...over });

describe("billRows", () => {
  it("keeps the card's rows counted in the month, newest first, by source id and not name", () => {
    const rows = [row({ id: "a" }), row({ id: "b", postedOn: "2030-01-09" }), row({ id: "c", sourceId: "s2" }), row({ id: "d", countsOn: "2030-03-05" })];
    expect(billRows(rows, "s1", "2030-02").map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("totals money out as a positive bill", () => expect(rowsTotal([row({}), row({ amountCents: -250 }), row({ amountCents: 100 })])).toBe(1150));
});

describe("readBillDays", () => {
  it("reads both days, or clears both", () => {
    expect(readBillDays(" 3", "10")).toEqual({ ok: true, closeDay: 3, dueDay: 10 });
    expect(readBillDays("", " ")).toEqual({ ok: true, closeDay: null, dueDay: null });
  });
  it("names the empty one required and a bad one invalid", () => {
    expect(readBillDays("3", "")).toEqual({ ok: false, errors: { dueDay: "required" } });
    expect(readBillDays("0", "32")).toEqual({ ok: false, errors: { closeDay: "invalid", dueDay: "invalid" } });
    expect(readBillDays("1.5", "x")).toEqual({ ok: false, errors: { closeDay: "invalid", dueDay: "invalid" } });
  });
});
