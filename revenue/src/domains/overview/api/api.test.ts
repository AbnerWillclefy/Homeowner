import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBills, getCommitments, getMonthTransactions } from "./api";

const get = vi.fn<(url: string, config?: { params?: unknown }) => Promise<{ status: number; data?: unknown }>>();
vi.mock("../../../api/client", () => ({ apiClient: { get: (url: string, config?: { params?: unknown }) => get(url, config) } }));

beforeEach(() => get.mockReset());

const month = {
  month: "2026-11", installments: [], cards: [], otherBills: [], otherInstallmentsCents: 0, planned: [], plannedCents: 0,
  totalCents: 1000, leftoverCents: 500, dailyAllowanceCents: 50, pace: { spentCents: [100, 200], lineEndCents: 900 },
};

describe("getCommitments", () => {
  it("asks for the month and returns the parsed body", async () => {
    get.mockResolvedValue({ status: 200, data: { monthlyIncomeCents: 1500, months: [month] } });
    const result = await getCommitments("2026-11");
    expect(get).toHaveBeenCalledWith("/me/finance/commitments", { params: { from: "2026-11" } });
    expect(result.months[0]!.pace).toEqual({ spentCents: [100, 200], lineEndCents: 900 });
  });
  it("reads absent allowance, pace and leftover as absent", async () => {
    const { dailyAllowanceCents, pace, leftoverCents, ...bare } = month;
    get.mockResolvedValue({ status: 200, data: { monthlyIncomeCents: null, months: [bare] } });
    const result = await getCommitments("2026-11");
    expect(result.monthlyIncomeCents).toBeNull();
    expect(result.months[0]!.pace).toBeUndefined();
  });
  it("rejects a malformed body", async () => {
    get.mockResolvedValue({ status: 200, data: { monthlyIncomeCents: 1, months: [{ ...month, pace: { spentCents: "x", lineEndCents: 1 } }] } });
    await expect(getCommitments("2026-11")).rejects.toThrow();
  });
  it("keeps the installments of each month", async () => {
    const installments = [{ name: "Geladeira", number: 2, total: 4, amountCents: 30000 }];
    get.mockResolvedValue({ status: 200, data: { monthlyIncomeCents: 1500, months: [{ ...month, installments }] } });
    expect((await getCommitments("2026-11")).months[0]!.installments).toEqual(installments);
  });
  it.each([["no installments", undefined], ["a part without its total", [{ name: "x", number: 1, amountCents: 1 }]]])("rejects %s", async (_, installments) => {
    get.mockResolvedValue({ status: 200, data: { monthlyIncomeCents: 1, months: [{ ...month, installments }] } });
    await expect(getCommitments("2026-11")).rejects.toThrow();
  });
  it("rejects a failed status", async () => {
    get.mockResolvedValue({ status: 500 });
    await expect(getCommitments("2026-11")).rejects.toThrow();
  });
});

describe("getBills", () => {
  const bill = { id: "b", name: "Luz", expectedCents: 100, dueDay: 5, dueDate: "2026-11-05", paid: false };
  it("asks for the month and fills a missing paidCents", async () => {
    get.mockResolvedValue({ status: 200, data: [bill] });
    const bills = await getBills("2026-11");
    expect(get).toHaveBeenCalledWith("/me/finance/bills", { params: { month: "2026-11" } });
    expect(bills[0]!.paidCents).toBeNull();
  });
  it("rejects a malformed body", async () => {
    get.mockResolvedValue({ status: 200, data: [{ ...bill, dueDate: 5 }] });
    await expect(getBills("2026-11")).rejects.toThrow();
  });
});

describe("getMonthTransactions", () => {
  const tx = { id: "t", postedOn: "2026-11-02", description: "Salário", sourceName: "Banco", amountCents: 100, type: "income", spendingCategory: null };
  const body = { month: "2026-11", spentCents: 0, categories: [], transactions: [tx] };
  it("asks for the month and defaults countsOn to postedOn", async () => {
    get.mockResolvedValue({ status: 200, data: body });
    const result = await getMonthTransactions("2026-11");
    expect(get).toHaveBeenCalledWith("/me/finance/transactions", { params: { month: "2026-11" } });
    expect(result.transactions[0]!.countsOn).toBe("2026-11-02");
  });
  it("rejects a malformed body", async () => {
    get.mockResolvedValue({ status: 200, data: { ...body, transactions: [{ ...tx, type: "gift" }] } });
    await expect(getMonthTransactions("2026-11")).rejects.toThrow();
  });
});
