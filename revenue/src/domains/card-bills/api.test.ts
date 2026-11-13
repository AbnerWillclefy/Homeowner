import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../../api/client";
import { createSessionStore } from "../../auth/session";
import { getCardBills, getCardSources, getMonthTransactions, putBillDays } from "./api";

function setup(status: number, data: unknown, fail = false) {
  const store = createSessionStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  store.save({ idToken: "id", refreshToken: "r", expiresAt: Date.now() + 3_600_000 });
  const sent: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config);
    if (fail) throw new Error("offline");
    return { data, status, statusText: "", headers: {}, config };
  };
  return { client: createApiClient({ baseUrl: "http://api.test", session: store, refresh: async () => ({ kind: "error" }), now: Date.now, adapter }), sent };
}

const CARD = { sourceId: "s1", name: "Nubank", amountCents: 1000, billDaysKnown: true, fromBank: true, dueOn: "2030-01-10", closesOn: "2030-01-03" };

describe("getCardBills", () => {
  it("reads the month's cards with their kind and dates", async () => {
    const { client, sent } = setup(200, { months: [{ month: "2030-01", cards: [CARD, { ...CARD, sourceId: "s2", fromBank: false, dueOn: null, closesOn: null }] }] });
    const cards = await getCardBills("2030-01", client);
    expect(cards.map((c) => [c.fromBank, c.dueOn])).toEqual([[true, "2030-01-10"], [false, null]]);
    expect(sent[0]!.params).toEqual({ from: "2030-01" });
  });
  it("throws on a failure and on a malformed card", async () => {
    await expect(getCardBills("2030-01", setup(503, {}).client)).rejects.toThrow();
    await expect(getCardBills("2030-01", setup(200, { months: [{ month: "2030-01", cards: [{ ...CARD, fromBank: "yes" }] }] }).client)).rejects.toThrow();
  });
});

describe("getCardSources", () => {
  it("keeps the credit cards with their days", async () => {
    const { client } = setup(200, { sources: [{ id: "s1", name: "Nubank", kind: "credit_card", closeDay: 3, dueDay: null }, { id: "s2", name: "Itaú", kind: "checking", closeDay: null, dueDay: null }] });
    expect(await getCardSources(client)).toEqual([{ id: "s1", name: "Nubank", closeDay: 3, dueDay: null }]);
  });
});

describe("getMonthTransactions", () => {
  it("reads rows with their source id", async () => {
    const row = { id: "t1", sourceId: "s1", description: "Mercado", postedOn: "2030-01-02", countsOn: "2030-02-10", amountCents: -500, installment: { number: 1, total: 3 } };
    const { client, sent } = setup(200, { transactions: [row] });
    expect(await getMonthTransactions("2030-02", client)).toEqual([row]);
    expect(sent[0]!.params).toEqual({ month: "2030-02" });
    await expect(getMonthTransactions("2030-02", setup(200, { transactions: [{ ...row, sourceId: undefined }] }).client)).rejects.toThrow();
  });
});

describe("putBillDays", () => {
  it("PUTs both days and expects 204", async () => {
    const { client, sent } = setup(204, "");
    expect(await putBillDays("s1", 3, 10, client)).toEqual({ kind: "ok" });
    expect([sent[0]!.method, sent[0]!.url, sent[0]!.data]).toEqual(["put", "/me/finance/sources/s1/bill-days", JSON.stringify({ closeDay: 3, dueDay: 10 })]);
  });
  it("hands back field codes, a missing card and other failures", async () => {
    expect(await putBillDays("s1", 0, 10, setup(400, { fields: { closeDay: "invalid" } }).client)).toEqual({ kind: "fields", fields: { closeDay: "invalid" } });
    expect(await putBillDays("s1", 3, 10, setup(404, {}).client)).toEqual({ kind: "not-found" });
    expect(await putBillDays("s1", 3, 10, setup(500, {}).client)).toEqual({ kind: "error" });
    expect(await putBillDays("s1", 3, 10, setup(0, {}, true).client)).toEqual({ kind: "error" });
  });
});
