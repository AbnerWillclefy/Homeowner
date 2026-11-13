import { describe, expect, it } from "vitest";
import type { Source } from "../api";
import { balanceLine, formatBalanceDay } from "./balance";

const source = (over: Partial<Source>): Source => ({ id: "s", name: "Itaú", bankName: "Itaú", kind: "checking", closeDay: null, dueDay: null, ...over });

describe("balanceLine", () => {
  it("shows the amount and the day it was read", () => {
    expect(balanceLine(source({ balanceCents: 12_345, balanceOn: "2026-11-08" }), "en")).toEqual({ kind: "known", cents: 12_345, day: "Nov 8, 2026" });
  });
  it("keeps a zero balance as an amount", () => {
    expect(balanceLine(source({ kind: "savings", balanceCents: 0, balanceOn: "2026-11-08" }), "en")).toMatchObject({ kind: "known", cents: 0 });
  });
  it("says unknown, not zero, for a bank account never synced", () => {
    expect(balanceLine(source({}), "pt-BR")).toEqual({ kind: "unknown" });
  });
  it("shows nothing for a card, even with a stray balance", () => {
    expect(balanceLine(source({ kind: "credit_card" }), "pt-BR")).toEqual({ kind: "none" });
    expect(balanceLine(source({ kind: "credit_card", balanceCents: 5, balanceOn: "2026-11-08" }), "pt-BR")).toEqual({ kind: "none" });
  });
});

describe("formatBalanceDay", () => {
  it("writes the calendar day in the locale without a zone shift", () => {
    expect(formatBalanceDay("2026-11-08", "pt-BR")).toBe("8 de nov. de 2026");
    expect(formatBalanceDay("2026-01-01", "en")).toBe("Jan 1, 2026");
  });
});
