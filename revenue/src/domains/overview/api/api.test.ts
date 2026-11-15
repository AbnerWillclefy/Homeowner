import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCommitments, getHistory } from "./api";

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
  it("rejects a card whose dueOn is not a string", async () => {
    const card = { sourceId: "s", name: "Nubank", amountCents: 1, billDaysKnown: true, dueOn: 5 };
    get.mockResolvedValue({ status: 200, data: { monthlyIncomeCents: 1, months: [{ ...month, cards: [card] }] } });
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

describe("getHistory", () => {
  const row = { month: "2026-11", incomeCents: 980000, spentCents: 500000, savedCents: 120000, categories: [] };
  it("asks for the months ending at `to` and keeps income, spent and saved", async () => {
    get.mockResolvedValue({ status: 200, data: { to: "2026-11", months: [row] } });
    expect(await getHistory("2026-11", 2)).toEqual([{ month: "2026-11", incomeCents: 980000, spentCents: 500000, savedCents: 120000 }]);
    expect(get).toHaveBeenCalledWith("/me/finance/history", { params: { to: "2026-11", months: "2" } });
  });
  it("rejects a month without its income", async () => {
    get.mockResolvedValue({ status: 200, data: { months: [{ ...row, incomeCents: undefined }] } });
    await expect(getHistory("2026-11", 2)).rejects.toThrow();
  });
  it("rejects a failed status", async () => {
    get.mockResolvedValue({ status: 500 });
    await expect(getHistory("2026-11", 2)).rejects.toThrow();
  });
});
