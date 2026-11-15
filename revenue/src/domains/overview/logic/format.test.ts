import { describe, expect, it } from "vitest";
import { percentText, shortMonth, shortMonthYear } from "./format";

describe("short months", () => {
  it("drops the abbreviation dot and lower-cases pt-BR", () => {
    expect(shortMonth("2026-10", "pt-BR")).toBe("out");
    expect(shortMonthYear("2027-06", "pt-BR")).toBe("jun/27");
  });
  it("keeps English as Intl writes it", () => {
    expect(shortMonthYear("2027-06", "en")).toBe("Jun/27");
  });
});

describe("percentText", () => {
  it("signs a change and keeps one decimal", () => {
    expect(percentText(4, "pt-BR")).toBe("+4%");
    expect(percentText(2.5, "pt-BR")).toBe("+2,5%");
    expect(percentText(-33, "en")).toBe("-33%");
    expect(percentText(0, "en")).toBe("0%");
  });
});
