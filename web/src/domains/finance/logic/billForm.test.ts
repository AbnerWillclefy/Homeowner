import { describe, expect, it } from "vitest";
import { billInputOf } from "./billForm";

describe("billInputOf", () => {
  it("turns the typed fields into the API body", () => {
    expect(billInputOf({ name: "  Luz ", amount: "1.234,56", dueDay: "5" }, "pt-BR")).toEqual({
      ok: true,
      input: { name: "Luz", expectedCents: 123456, dueDay: 5 },
    });
  });
  it("names each field that is wrong, with the API's codes", () => {
    expect(billInputOf({ name: " ", amount: "abc", dueDay: "32" }, "en-US")).toEqual({
      ok: false,
      errors: { name: "required", expectedCents: "invalid", dueDay: "invalid" },
    });
  });
  it("refuses a due day that is not a whole number", () => {
    expect(billInputOf({ name: "Luz", amount: "10", dueDay: "2.5" }, "en-US")).toMatchObject({ ok: false, errors: { dueDay: "invalid" } });
    expect(billInputOf({ name: "Luz", amount: "10", dueDay: "" }, "en-US")).toMatchObject({ ok: false, errors: { dueDay: "invalid" } });
  });
  it("refuses a name over 60 characters", () => {
    expect(billInputOf({ name: "a".repeat(61), amount: "10", dueDay: "1" }, "en-US")).toMatchObject({ ok: false, errors: { name: "too_long" } });
  });
});
