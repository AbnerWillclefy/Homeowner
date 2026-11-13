import { describe, expect, it } from "vitest";
import type { CommitmentMonth } from "../api/api";
import { monthRows } from "./monthRows";

const month = (change: Partial<CommitmentMonth> = {}): CommitmentMonth => ({
  month: "2026-12",
  cards: [],
  otherBills: [],
  installments: [],
  otherInstallmentsCents: 0,
  planned: [],
  plannedCents: 0,
  totalCents: 0,
  ...change,
});

describe("monthRows", () => {
  it("lists a line per card, per other Bill and per planned category, with each group's subtotal", () => {
    const rows = monthRows(
      month({
        cards: [
          { sourceId: "a", name: "Nubank", amountCents: 100000, billDaysKnown: true },
          { sourceId: "b", name: "Inter", amountCents: 50000, billDaysKnown: true },
        ],
        otherBills: [
          { id: "1", name: "Aluguel", cents: 200000, paid: true },
          { id: "2", name: "Luz", cents: 15000, paid: false },
        ],
        planned: [{ category: "groceries", cents: 80000 }],
        plannedCents: 80000,
        totalCents: 445000,
        leftoverCents: 55000,
      }),
    );
    expect(rows.groups.map((g) => [g.id, g.cents, g.items.length])).toEqual([
      ["cards", 150000, 2],
      ["bills", 215000, 2],
      ["planned", 80000, 1],
    ]);
    expect(rows.groups[1]!.items.map((i) => i.kind === "bill" && i.paid)).toEqual([true, false]);
    expect(rows.totalCents).toBe(445000);
    expect(rows.leftoverCents).toBe(55000);
  });

  it("marks a card without its days and keeps a month with no card bill as an empty group", () => {
    const [cards] = monthRows(month({ cards: [{ sourceId: "a", name: "Inter", amountCents: 0, billDaysKnown: false }] })).groups;
    expect(cards!.items).toEqual([{ kind: "card", key: "a", name: "Inter", cents: 0, daysKnown: false }]);
    const empty = monthRows(month()).groups;
    expect(empty.map((g) => g.id)).toEqual(["cards"]);
    expect(empty[0]!.items).toEqual([]);
  });

  it("adds installments off the card to the other Bills only when there are some", () => {
    expect(monthRows(month()).groups.some((g) => g.id === "bills")).toBe(false);
    const [, bills] = monthRows(month({ otherInstallmentsCents: 30000 })).groups;
    expect(bills).toMatchObject({ id: "bills", cents: 30000, items: [{ kind: "offCardInstallments", cents: 30000 }] });
  });

  it("shows the spending off the card only when the API sends it, even when zero", () => {
    expect(monthRows(month()).groups.some((g) => g.id === "spent")).toBe(false);
    const groups = monthRows(month({ spentOffCardCents: 0 })).groups;
    expect(groups.at(-1)).toEqual({ id: "spent", cents: 0, items: [] });
  });

  it("adds the money put aside after the spending off the card, so the groups add up to the total", () => {
    expect(monthRows(month()).groups.some((g) => g.id === "saving")).toBe(false);
    const rows = monthRows(
      month({
        cards: [{ sourceId: "a", name: "Nubank", amountCents: 100000, billDaysKnown: true }],
        otherBills: [{ id: "1", name: "Luz", cents: 20000, paid: false }],
        planned: [{ category: "groceries", cents: 30000 }],
        plannedCents: 30000,
        spentOffCardCents: 40000,
        savingCents: 50000,
        totalCents: 240000,
      }),
    );
    expect(rows.groups.map((g) => g.id)).toEqual(["cards", "bills", "planned", "spent", "saving"]);
    expect(rows.groups.at(-1)).toEqual({ id: "saving", cents: 50000, items: [] });
    expect(rows.groups.reduce((a, g) => a + g.cents, 0)).toBe(rows.totalCents);
  });

  it("has no leftover without income, and says by how much a total passes it", () => {
    expect(monthRows(month({ totalCents: 1000 }))).toMatchObject({ leftoverCents: null, overCents: 0 });
    expect(monthRows(month({ totalCents: 150000, leftoverCents: -50000 }))).toMatchObject({ leftoverCents: -50000, overCents: 50000 });
    expect(monthRows(month({ totalCents: 100000, leftoverCents: 0 })).overCents).toBe(0);
  });
});
