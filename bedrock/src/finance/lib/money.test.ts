import { describe, expect, it } from "vitest";
import { parseCents } from "./money";

describe("parseCents", () => {
  it.each([
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["1234.56", 123456],
    ["1234,5", 123450],
    ["1.234", 123400],
    ["1,234", 123400],
    ["R$ 1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    [" 1 234,56 ", 123456],
    ["1 234,56", 123456],
    ["1.234.567,89", 123456789],
    ["0,5", 50],
    ["0,05", 5],
    ["12", 1200],
    ["0", 0],
    ["0,00", 0],
  ])("parses %j to %j cents", (text, cents) => {
    expect(parseCents(text)).toBe(cents);
  });

  it.each([[""], ["   "], ["abc"], ["R$"]])("gives no value for %j", (text) => {
    expect(parseCents(text)).toBeNull();
  });

  it.each([["-5"], ["−5"], ["R$ -1,00"]])("rejects negative %j", (text) => {
    expect(parseCents(text)).toBeNull();
  });

  it.each([["1.234,567"], ["12,3,4"], ["1.23.456"], ["1,2.3,4"], ["1+2"], ["99999999999999999"], ["0.234"], ["0,234"], ["R$ 10 a R$ 20"], ["1e3"]])(
    "rejects malformed %j",
    (text) => {
      expect(parseCents(text)).toBeNull();
    },
  );
});
