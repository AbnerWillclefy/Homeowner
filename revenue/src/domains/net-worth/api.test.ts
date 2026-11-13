import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../../api/client";
import { createSessionStore } from "../../auth/session";
import { getNetWorth, parseNetWorth } from "./api";

const BODY = {
  hasData: true,
  today: { totalCents: 1_000_000, balancesCents: 600_000, investmentsCents: 500_000, cardBillsCents: 100_000 },
  series: [{ day: "2026-11-12", cents: 1_050_000 }, { day: "2026-11-13", cents: 1_100_000 }],
  seriesExcludesCardBills: true,
};

function setup(status: number, data: unknown, fail = false) {
  const store = createSessionStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  store.save({ idToken: "id", refreshToken: "r", expiresAt: Date.now() + 3_600_000 });
  const sent: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config);
    if (fail) throw new Error("offline");
    return { data, status, statusText: "", headers: {}, config };
  };
  const client = createApiClient({ baseUrl: "http://api.test", session: store, refresh: async () => ({ kind: "error" }), now: Date.now, adapter });
  return { client, sent };
}

describe("parseNetWorth", () => {
  it("reads the parts exactly as given and the series", () => {
    expect(parseNetWorth(BODY)).toEqual(BODY);
  });
  it("takes no data: today null, empty series", () => {
    const empty = { hasData: false, today: null, series: [], seriesExcludesCardBills: true };
    expect(parseNetWorth(empty)).toEqual(empty);
  });
  it("ignores fields it does not know", () => {
    expect(parseNetWorth({ ...BODY, brandNew: 1, series: [{ day: "2026-11-13", cents: 5, extra: true }] })?.series).toEqual([{ day: "2026-11-13", cents: 5 }]);
  });
  it.each([
    ["not an object", null],
    ["data without today", { ...BODY, today: null }],
    ["a text part", { ...BODY, today: { ...BODY.today, cardBillsCents: "1" } }],
    ["a series that is not a list", { ...BODY, series: {} }],
    ["a point without a day", { ...BODY, series: [{ cents: 1 }] }],
    ["no exclusion flag", { ...BODY, seriesExcludesCardBills: undefined }],
  ])("refuses %s", (_, v) => expect(parseNetWorth(v)).toBeNull());
});

describe("getNetWorth", () => {
  it.each(["30d", "90d", "1y"] as const)("reads the %s range", async (range) => {
    const { client, sent } = setup(200, BODY);
    expect((await getNetWorth(range, client)).today?.totalCents).toBe(1_000_000);
    expect(sent[0]!.url).toBe("/me/finance/net-worth");
    expect(sent[0]!.params).toEqual({ range });
  });
  it("throws on a failure status, a network failure and a malformed body", async () => {
    await expect(getNetWorth("30d", setup(503, {}).client)).rejects.toThrow();
    await expect(getNetWorth("30d", setup(200, BODY, true).client)).rejects.toThrow();
    await expect(getNetWorth("30d", setup(200, { hasData: 1 }).client)).rejects.toThrow();
  });
});
