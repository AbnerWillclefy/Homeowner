import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import { choreFieldErrorKey } from "./fieldErrors";

// Every code backend/internal/chores/chores.go Validate can return, per field.
const API_CODES: [string, string][] = [
  ["name", "required"],
  ["name", "too_long"],
  ["category", "required"],
  ["category", "unknown"],
  ["importance", "required"],
  ["importance", "unknown"],
  ["demands", "unknown"],
  ["baseEffort", "required"],
  ["baseEffort", "invalid"],
  ["baseEffort", "out_of_range"],
  ["people", "required"],
  ["people", "invalid"],
  ["people", "out_of_range"],
  ["intervalDays", "required"],
  ["intervalDays", "invalid"],
  ["intervalDays", "out_of_range"],
  ["allowedWeekdays", "invalid"],
  ["allowedWeekdays", "out_of_range"],
];

describe("choreFieldErrorKey", () => {
  it.each(API_CODES)("maps %s %s to its own message", (field, code) => {
    expect(choreFieldErrorKey(field, code)).toBe(`chores.field.${field}.${code}`);
  });

  it.each(API_CODES)("has %s %s in both languages", (field, code) => {
    const key = choreFieldErrorKey(field, code);
    expect(enUS[key]).toBeTruthy();
    expect(ptBR[key]).toBeTruthy();
  });

  it("falls back to a generic message for a code it does not know", () => {
    expect(choreFieldErrorKey("name", "brand_new")).toBe("chores.field.unknown");
    expect(choreFieldErrorKey("somethingElse", "required")).toBe("chores.field.unknown");
  });
});
