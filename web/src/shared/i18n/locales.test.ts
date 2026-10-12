import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "./locales";

describe("isLocale", () => {
  it("accepts exactly the two supported tags", () => {
    expect([...LOCALES]).toEqual(["en-US", "pt-BR"]);
    expect(isLocale("en-US")).toBe(true);
    expect(isLocale("pt-BR")).toBe(true);
  });

  it.each(["pt", "pt-pt", "en", "", "fr"])("rejects %j", (value) => {
    expect(isLocale(value)).toBe(false);
  });

  it.each([null, undefined, 42, {}, ["pt-BR"]])("rejects non-string %j", (value) => {
    expect(isLocale(value)).toBe(false);
  });

  it("defaults to en-US", () => {
    expect(DEFAULT_LOCALE).toBe("en-US");
  });
});
