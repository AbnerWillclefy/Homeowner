import { describe, expect, it } from "vitest";
import { enUS } from "../shared/i18n/catalogs/en-US";
import { ptBR } from "../shared/i18n/catalogs/pt-BR";
import { fieldErrorKey } from "./fieldErrors";

// Every code backend/internal/server/home.go can return, per field.
const API_CODES: [string, string][] = [
  ["timezone", "required"],
  ["timezone", "unknown"],
  ["allocationTime", "required"],
  ["allocationTime", "invalid"],
  ["allocationTime", "not_quarter_hour"],
];

describe("fieldErrorKey", () => {
  it.each(API_CODES)("maps %s %s to its own message", (field, code) => {
    expect(fieldErrorKey(field, code)).toBe(`home.field.${field}.${code}`);
  });

  it.each(API_CODES)("has %s %s in both languages", (field, code) => {
    const key = fieldErrorKey(field, code);
    expect(enUS[key]).toBeTruthy();
    expect(ptBR[key]).toBeTruthy();
  });

  it("falls back to a generic message for a code it does not know", () => {
    expect(fieldErrorKey("timezone", "brand_new")).toBe("home.field.unknown");
    expect(fieldErrorKey("somethingElse", "required")).toBe("home.field.unknown");
  });
});
