import { describe, expect, it } from "vitest";
import { centsToInput, formatCents } from "./money";
import { parseMoney } from "./parseMoney";

describe("centsToInput", () => {
  it("writes the amount the way the locale types it, and parseMoney reads it back", () => {
    expect(centsToInput(123456, "pt-BR")).toBe("1234,56");
    expect(centsToInput(123456, "en-US")).toBe("1234.56");
    expect(parseMoney(centsToInput(123456, "pt-BR"), "pt-BR")).toBe(123456);
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
