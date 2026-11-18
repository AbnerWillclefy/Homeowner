import { describe, expect, it } from "vitest";
import { manualCardFieldErrorKey, manualCardInputOf, manualMonths } from "./manualCardForm";

const months = manualMonths("2026-11");
const ok = { name: " Fatura Naiara ", dueDay: "10", pixRecipient: "", bills: {} };

describe("manualMonths", () => {
  it("is this month and the 11 after it, across the year end", () => {
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2026-11");
    expect(months[2]).toBe("2027-01");
    expect(months[11]).toBe("2027-10");
  });
});

describe("manualCardInputOf", () => {
  it("trims, sends an empty month as null and an empty recipient as null", () => {
    const result = manualCardInputOf({ ...ok, bills: { "2026-11": 119_000, "2027-05": 0 } }, months);
    expect(result).toMatchObject({ ok: true, input: { name: "Fatura Naiara", dueDay: 10, pixRecipient: null } });
    if (!result.ok) return;
    expect(Object.keys(result.input.bills)).toEqual(months);
    expect(result.input.bills["2026-11"]).toBe(119_000);
    expect(result.input.bills["2027-05"]).toBe(0); // a typed zero is not an empty month
    expect(result.input.bills["2026-12"]).toBeNull();
  });

  it("trims the recipient", () => {
    const result = manualCardInputOf({ ...ok, pixRecipient: "  Naiara Souza " }, months);
    expect(result.ok && result.input.pixRecipient).toBe("Naiara Souza");
  });

  it.each([
    ["no name", { name: "  " }, { name: "required" }],
    ["a 61-character name", { name: "a".repeat(61) }, { name: "too_long" }],
    ["day 0", { dueDay: "0" }, { dueDay: "invalid" }],
    ["day 32", { dueDay: "32" }, { dueDay: "invalid" }],
    ["a day that is not digits", { dueDay: "1x" }, { dueDay: "invalid" }],
    ["a 61-character recipient", { pixRecipient: "a".repeat(61) }, { pixRecipient: "too_long" }],
    ["a bill over the ceiling", { bills: { "2026-11": 1_000_000_000_001 } }, { bills: "invalid" }],
    ["a negative bill", { bills: { "2026-11": -1 } }, { bills: "invalid" }],
  ])("refuses %s", (_, over, errors) => {
    expect(manualCardInputOf({ ...ok, ...over }, months)).toEqual({ ok: false, errors });
  });

  it("accepts day 1, day 31, 60 characters and the ceiling", () => {
    for (const fields of [{ dueDay: "1" }, { dueDay: "31" }, { name: "a".repeat(60) }, { bills: { "2026-11": 1_000_000_000_000 } }]) {
      expect(manualCardInputOf({ ...ok, ...fields }, months).ok).toBe(true);
    }
  });
});

describe("manualCardFieldErrorKey", () => {
  it("maps the API's bill codes and falls back for an unknown one", () => {
    expect(manualCardFieldErrorKey("bills", "invalid_month")).toBe("manualCard.field.bills.invalidMonth");
    expect(manualCardFieldErrorKey("bills", "other")).toBe("bills.field.unknown");
  });
});
