import { describe, expect, it } from "vitest";
import { nextDue, openCardBillsCents, ranOutCount } from "./more";

describe("nextDue", () => {
  it("is the earliest date among the unpaid", () => {
    expect(nextDue([{ paid: true, dueDate: "2030-01-02" }, { paid: false, dueDate: "2030-01-29" }, { paid: false, dueDate: "2030-01-09" }])).toBe("2030-01-09");
  });
  it("is null when everything is paid", () => expect(nextDue([{ paid: true, dueDate: "2030-01-02" }])).toBeNull());
});

describe("openCardBillsCents", () => {
  it("adds the cards up", () => expect(openCardBillsCents([{ amountCents: 100 }, { amountCents: 250 }])).toBe(350));
  it("is null with no card", () => expect(openCardBillsCents([])).toBeNull());
});

it("counts the items that ran out", () => {
  expect(ranOutCount([{ state: "in_stock" }, { state: "ran_out" }, { state: "ran_out" }])).toBe(2);
});
