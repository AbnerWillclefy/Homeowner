import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../../api/client";
import { createSessionStore } from "../../auth/session";
import { getMonth, patchTransaction } from "./api";

const TX = {
  id: "t1", postedOn: "2030-01-05", countsOn: "2030-01-05", description: "Mercado", sourceName: "Nubank", amountCents: -1500,
  currency: "BRL", type: "expense", spendingCategory: "groceries", typeSetBy: "auto", categorySetBy: "auto", installment: null,
};

function setup(status: number, data: unknown) {
  const store = createSessionStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  store.save({ idToken: "id", refreshToken: "r", expiresAt: Date.now() + 3_600_000 });
  const sent: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config);
    return { data, status, statusText: "", headers: {}, config };
  };
  const client = createApiClient({ baseUrl: "http://api.test", session: store, refresh: async () => ({ kind: "error" }), now: Date.now, adapter });
  return { client, sent };
}

describe("getMonth", () => {
  it("reads the month's transactions", async () => {
    const body = { month: "2030-01", spentCents: 1500, categories: [], transactions: [TX], limits: {} };
    const { client, sent } = setup(200, body);
    expect((await getMonth("2030-01", client)).transactions).toMatchObject([{ id: "t1", description: "Mercado", spendingCategory: "groceries", installment: null }]);
    expect(sent[0]!.url).toBe("/me/finance/transactions");
    expect(sent[0]!.params).toEqual({ month: "2030-01" });
  });

  it("throws on a failure status and on a malformed body", async () => {
    await expect(getMonth("2030-01", setup(503, {}).client)).rejects.toThrow();
    await expect(getMonth("2030-01", setup(200, { transactions: "x" }).client)).rejects.toThrow();
    await expect(getMonth("2030-01", setup(200, { transactions: [{ id: 1 }] }).client)).rejects.toThrow();
  });
});

describe("patchTransaction", () => {
  it("sends only the changed fields and returns the row", async () => {
    const { client, sent } = setup(200, { ...TX, type: "transfer", spendingCategory: null });
    const result = await patchTransaction("t/1", { type: "transfer" }, client);
    expect(result).toMatchObject({ kind: "ok", transaction: { type: "transfer", spendingCategory: null } });
    expect(sent[0]!.method).toBe("patch");
    expect(sent[0]!.url).toBe("/me/finance/transactions/t%2F1");
    expect(JSON.parse(String(sent[0]!.data))).toEqual({ type: "transfer" });
  });

  it("returns the field codes of a 400", async () => {
    const { client } = setup(400, { error: "invalid", fields: { spendingCategory: "needs_expense" } });
    expect(await patchTransaction("t1", { spendingCategory: "pets" }, client)).toEqual({ kind: "fields", fields: { spendingCategory: "needs_expense" } });
  });

  it("names a missing row", async () => {
    expect(await patchTransaction("t1", { type: "income" }, setup(404, {}).client)).toEqual({ kind: "not-found" });
  });

  it("is an error for another status, a 400 without fields, and a malformed 200", async () => {
    expect(await patchTransaction("t1", { type: "income" }, setup(500, {}).client)).toEqual({ kind: "error" });
    expect(await patchTransaction("t1", { type: "income" }, setup(400, "nope").client)).toEqual({ kind: "error" });
    expect(await patchTransaction("t1", { type: "income" }, setup(200, { id: 5 }).client)).toEqual({ kind: "error" });
  });
});
