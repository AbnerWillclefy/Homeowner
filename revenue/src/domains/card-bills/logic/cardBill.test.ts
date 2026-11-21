import { describe, expect, it } from "vitest";
import type { CardTransaction } from "../api";
import { readBillDays } from "./billDays";
import { billRows, billSplit, pickCard } from "./cardBill";

const row = (over: Partial<CardTransaction>): CardTransaction => ({ id: "t1", sourceId: "s1", description: "x", postedOn: "2030-01-02", countsOn: "2030-02-05", amountCents: -1000, installment: null, spendingCategory: null, ...over });

describe("billRows", () => {
  it("keeps the card's rows counted in the month, newest first, by source id and not name", () => {
    const rows = [row({ id: "a" }), row({ id: "b", postedOn: "2030-01-09" }), row({ id: "c", sourceId: "s2" }), row({ id: "d", countsOn: "2030-03-05" })];
    expect(billRows(rows, { sourceId: "s1", heldFrom: null, heldTo: null }, "2030-02").map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("keeps a cycle's rows by posted day from its start, before its end when closed, whatever month they count in", () => {
    const rows = [row({ id: "before", postedOn: "2030-01-19" }), row({ id: "start", postedOn: "2030-01-20" }), row({ id: "later", postedOn: "2030-02-10", countsOn: "2030-03-05" }), row({ id: "end", postedOn: "2030-02-20" })];
    expect(billRows(rows, { sourceId: "s1", heldFrom: "2030-01-20", heldTo: null }, "2030-02").map((r) => r.id)).toEqual(["end", "later", "start"]);
    expect(billRows(rows, { sourceId: "s1", heldFrom: "2030-01-20", heldTo: "2030-02-20" }, "2030-02").map((r) => r.id)).toEqual(["later", "start"]);
  });
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

describe("billSplit", () => {
  it("sorts the rows into installments, subscriptions and purchases, and adds up to the rows", () => {
    const rows = [
      row({ id: "a", amountCents: -1000 }),
      row({ id: "b", amountCents: -2500, installment: { number: 1, total: 3 } }),
      row({ id: "c", amountCents: -400, spendingCategory: "subscriptions" }),
      row({ id: "d", amountCents: -900, spendingCategory: "subscriptions", installment: { number: 2, total: 2 } }),
      row({ id: "e", amountCents: 200 }),
    ];
    const split = billSplit(rows);
    expect(split).toEqual({ purchasesCents: 800, installmentsCents: 3400, subscriptionsCents: 400 });
    expect(split.purchasesCents + split.installmentsCents + split.subscriptionsCents).toBe(-rows.reduce((n, r) => n + r.amountCents, 0));
  });
});

describe("pickCard", () => {
  const cards = [{ sourceId: "a" }, { sourceId: "b" }];
  it("takes the named card, else the first", () => {
    expect(pickCard(cards, "b")).toBe(cards[1]);
    expect(pickCard(cards, "gone")).toBe(cards[0]);
    expect(pickCard(cards, null)).toBe(cards[0]);
    expect(pickCard([], "a")).toBeUndefined();
  });
});
