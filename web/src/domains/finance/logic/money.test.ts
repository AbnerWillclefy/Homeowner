import { describe, expect, it } from "vitest";
import { centsToInput, formatCents, parseMoney } from "./money";

describe("centsToInput", () => {
  it("writes the amount the way the locale types it, and parseMoney reads it back", () => {
    expect(centsToInput(123456, "pt-BR")).toBe("1234,56");
    expect(centsToInput(123456, "en-US")).toBe("1234.56");
    expect(parseMoney(centsToInput(123456, "pt-BR"))).toBe(123456);
  });
});

// pt-BR puts a non-breaking space after R$.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("formatCents", () => {
  it("writes pt-BR as R$ 1.234,56", () => {
    expect(plain(formatCents(123456, "pt-BR"))).toBe("R$ 1.234,56");
  });
  it("writes en-US as R$1,234.56, still BRL", () => {
    expect(plain(formatCents(123456, "en-US"))).toBe("R$1,234.56");
  });
  it("keeps cents exact and signs a refund", () => {
    expect(plain(formatCents(5, "pt-BR"))).toBe("R$ 0,05");
    expect(plain(formatCents(-1999, "pt-BR"))).toBe("-R$ 19,99");
  });
});

describe("parseMoney", () => {
  it.each([
    ["5000", 500000],
    ["5.000,50", 500050],
    ["5,000.50", 500050],
    ["R$ 1.234,5", 123450],
    ["12,5", 1250],
    ["0,05", 5],
    ["1.234", 123400],
    ["0", 0],
  ])("reads %s", (text, cents) => expect(parseMoney(text)).toBe(cents));
  it.each(["", "  ", "abc", "-5", "1,2,3", "1e3", "1.2345"])("refuses %j", (text) => expect(parseMoney(text)).toBeNull());
});
