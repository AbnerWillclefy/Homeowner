import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../../api/client";
import { createSessionStore } from "../../auth/session";
import { getHistory, getSpending, putBudget } from "./api";

const TX = { id: "t1", postedOn: "2030-01-05", description: "Mercado", amountCents: -1500, type: "expense", spendingCategory: "groceries", categorySetBy: "auto" };

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

describe("getSpending", () => {
  it("reads the category totals, the limits and the rows", async () => {
    const body = { categories: [{ category: "groceries", spentCents: 1500 }], limits: { groceries: 2000 }, transactions: [TX, { ...TX, id: "t2", categorySetBy: "fallback" }] };
    const { client, sent } = setup(200, body);
    const spending = await getSpending("2030-01", client);
    expect(spending).toMatchObject({ categories: [{ category: "groceries", spentCents: 1500 }], limits: { groceries: 2000 } });
    expect(spending.transactions.map((t) => t.categorySetBy)).toEqual(["auto", "fallback"]);
    expect(sent[0]!.params).toEqual({ month: "2030-01" });
  });

  it("reads a body without limits as none", async () => {
    expect((await getSpending("2030-01", setup(200, { categories: [], transactions: [] }).client)).limits).toEqual({});
  });

  it("throws on a failure status, an unknown category and a malformed limit", async () => {
    await expect(getSpending("2030-01", setup(503, {}).client)).rejects.toThrow();
    await expect(getSpending("2030-01", setup(200, { categories: [{ category: "nope", spentCents: 1 }], transactions: [] }).client)).rejects.toThrow();
    await expect(getSpending("2030-01", setup(200, { categories: [], limits: { groceries: 0 }, transactions: [] }).client)).rejects.toThrow();
    await expect(getSpending("2030-01", setup(200, { categories: [], transactions: [{ id: 1 }] }).client)).rejects.toThrow();
  });
});

describe("getHistory", () => {
  it("reads the months asked for", async () => {
    const body = { to: "2030-01", months: [{ month: "2030-01", spentCents: 1500, categories: [{ category: "groceries", spentCents: 1500 }] }] };
    const { client, sent } = setup(200, body);
    expect((await getHistory("2030-01", 6, client)).months[0]!.categories[0]!.spentCents).toBe(1500);
    expect(sent[0]!.url).toBe("/me/finance/history");
    expect(sent[0]!.params).toEqual({ to: "2030-01", months: 6 });
  });

  it("throws on a malformed body", async () => {
    await expect(getHistory("2030-01", 6, setup(200, { months: "x" }).client)).rejects.toThrow();
    await expect(getHistory("2030-01", 6, setup(200, { months: [{ month: "2030-13", spentCents: 1, categories: [] }] }).client)).rejects.toThrow();
    await expect(getHistory("2030-01", 6, setup(200, { months: [{ month: "2030-01", spentCents: 1, categories: [{ category: "groceries" }] }] }).client)).rejects.toThrow();
    await expect(getHistory("2030-01", 6, setup(500, {}).client)).rejects.toThrow();
  });
});

describe("putBudget", () => {
  it("sends the limit", async () => {
    const { client, sent } = setup(204, "");
    expect(await putBudget("groceries", 25000, client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("put");
    expect(sent[0]!.url).toBe("/me/finance/budgets/groceries");
    expect(JSON.parse(String(sent[0]!.data))).toEqual({ limitCents: 25000 });
  });

  it("sends null to remove it", async () => {
    const { client, sent } = setup(204, "");
    expect(await putBudget("eating_out", null, client)).toEqual({ kind: "ok" });
    expect(JSON.parse(String(sent[0]!.data))).toEqual({ limitCents: null });
  });

  it("is an error for another status", async () => {
    expect(await putBudget("groceries", 100, setup(400, {}).client)).toEqual({ kind: "error" });
    expect(await putBudget("groceries", 100, setup(500, {}).client)).toEqual({ kind: "error" });
  });
});
