import { describe, expect, it } from "vitest";
import { parseMoney } from "./parseMoney";

describe("parseMoney", () => {
  it("reads pt-BR with a dot for thousands and a comma for cents", () => {
    expect(parseMoney("1.234,56", "pt-BR")).toBe(123456);
    expect(parseMoney("R$ 1.234,56", "pt-BR")).toBe(123456);
    expect(parseMoney("R$ 5,5", "pt-BR")).toBe(550);
    expect(parseMoney("1500", "pt-BR")).toBe(150000);
  });
  it("reads en-US with a comma for thousands and a dot for cents", () => {
    expect(parseMoney("1,234.56", "en-US")).toBe(123456);
    expect(parseMoney(" R$1,234.5 ", "en-US")).toBe(123450);
    expect(parseMoney("0.05", "en-US")).toBe(5);
  });
  it("stays exact where a float would not", () => {
    expect(parseMoney("0,29", "pt-BR")).toBe(29);
    expect(parseMoney("1.005,10", "pt-BR")).toBe(100510);
  });
  it("refuses more than two decimals, a negative, zero and junk", () => {
    for (const text of ["1,234", "1,5,5", "-10,00", "0", "0,00", "", "R$", "abc", "12a", "1.23", "1,2.3", ",50", "1e3"]) {
      expect(parseMoney(text, "pt-BR"), text).toBeNull();
    }
    expect(parseMoney("1,234.567", "en-US")).toBeNull();
    expect(parseMoney("-5.00", "en-US")).toBeNull();
  });
  it("refuses an amount the API would", () => {
    expect(parseMoney("10.000.000.000,01", "pt-BR")).toBeNull();
    expect(parseMoney("10.000.000.000,00", "pt-BR")).toBe(1_000_000_000_000);
  });
});
