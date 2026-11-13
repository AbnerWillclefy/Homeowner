import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, NotSignedIn } from "../../api/client";
import { createConnectToken, getSources, parseStatus, putSourceName, registerItem } from "./api";

const bank = { id: "s1", name: "Itaú", bankName: "Itaú", kind: "checking", closeDay: null, dueDay: null };
const status = (sources: unknown[] = [bank]) => ({ configured: true, importing: false, lastSyncedAt: "2026-11-08T13:05:00Z", sources });

describe("parseStatus", () => {
  it("reads a Source with and without its balance", () => {
    const parsed = parseStatus(status([bank, { ...bank, id: "s2", balanceCents: 123_45, balanceOn: "2026-11-08" }]));
    expect(parsed?.sources[0]).not.toHaveProperty("balanceCents");
    expect(parsed?.sources[1]).toMatchObject({ balanceCents: 12_345, balanceOn: "2026-11-08" });
    expect(parsed).toMatchObject({ importing: false, lastSyncedAt: "2026-11-08T13:05:00Z" });
  });

  it("keeps a zero balance, which is not 'no balance'", () => {
    expect(parseStatus(status([{ ...bank, balanceCents: 0, balanceOn: "2026-11-08" }]))?.sources[0]?.balanceCents).toBe(0);
  });

  it("stands in for a missing bank name and idle sync keys", () => {
    expect(parseStatus({ sources: [{ id: "s1", name: "Nu", kind: "credit_card" }] })).toEqual({
      sources: [{ id: "s1", name: "Nu", bankName: "Nu", kind: "credit_card", closeDay: null, dueDay: null }],
      importing: false,
      lastSyncedAt: null,
    });
  });

  it.each([
    ["not an object", "x"],
    ["null", null],
    ["no sources", { importing: false }],
    ["sources not a list", { sources: {} }],
    ["importing not a boolean", { ...status(), importing: "no" }],
    ["lastSyncedAt a number", { ...status(), lastSyncedAt: 3 }],
    ["a Source not an object", status(["x"])],
    ["a Source without an id", status([{ ...bank, id: 1 }])],
    ["a balance without its day", status([{ ...bank, balanceCents: 5 }])],
    ["a day without its balance", status([{ ...bank, balanceOn: "2026-11-08" }])],
    ["a fractional balance", status([{ ...bank, balanceCents: 1.5, balanceOn: "2026-11-08" }])],
    ["a balance day that is not text", status([{ ...bank, balanceCents: 5, balanceOn: 8 }])],
    ["a close day that is text", status([{ ...bank, closeDay: "8" }])],
  ])("refuses %s", (_, body) => {
    expect(parseStatus(body)).toBeNull();
  });
});

const reply = (s: number, data?: unknown) => ({ status: s, data });
let request: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.restoreAllMocks();
  request = vi.spyOn(apiClient, "request");
});
const answer = (value: unknown) => request.mockResolvedValue(value as never);
const refuse = (error: unknown) => request.mockRejectedValue(error);

describe("getSources", () => {
  it("returns the parsed status", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue(reply(200, status()));
    expect((await getSources()).sources).toHaveLength(1);
  });
  it.each([reply(200, { nope: 1 }), reply(200, "x"), reply(500, status()), reply(403)])("throws on %j", async (response) => {
    vi.spyOn(apiClient, "get").mockResolvedValue(response);
    await expect(getSources()).rejects.toThrow();
  });
});

describe("createConnectToken", () => {
  it("returns the token and the sandbox flag", async () => {
    answer(reply(200, { connectToken: "t", includeSandbox: true }));
    expect(await createConnectToken()).toEqual({ kind: "ok", connectToken: "t", includeSandbox: true });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", url: "/me/finance/connect-token" }));
  });
  it.each([[{}], [{ connectToken: "", includeSandbox: false }], [{ connectToken: "t" }], [{ connectToken: 1, includeSandbox: false }], ["x"], [null]])("treats the body %j as an error", async (body) => {
    answer(reply(200, body));
    expect(await createConnectToken()).toEqual({ kind: "error" });
  });
  it.each([
    [reply(409), "no-credentials"],
    [reply(422, { error: "pluggy_credentials_rejected" }), "rejected"],
    [reply(422, { error: "other" }), "item-refused"],
    [reply(502), "unavailable"],
    [reply(500, "oops"), "error"],
  ])("maps %j to %s", async (response, kind) => {
    answer(response);
    expect(await createConnectToken()).toEqual({ kind });
  });
  it("tells a lost session from a lost connection", async () => {
    refuse(new NotSignedIn());
    expect(await createConnectToken()).toEqual({ kind: "not-signed-in" });
    refuse(new Error("network"));
    expect(await createConnectToken()).toEqual({ kind: "offline" });
  });
});

describe("registerItem", () => {
  it("sends the item and returns the new status", async () => {
    answer(reply(200, status()));
    const result = await registerItem("item-1");
    expect(result.kind).toBe("ok");
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", url: "/me/finance/items", data: { itemId: "item-1" } }));
  });
  it("treats a malformed status as an error", async () => {
    answer(reply(200, { sources: "x" }));
    expect(await registerItem("i")).toEqual({ kind: "error" });
  });
  it("maps a login failure and a Pluggy outage", async () => {
    answer(reply(422, { error: "item login failed" }));
    expect(await registerItem("i")).toEqual({ kind: "item-refused" });
    answer(reply(502));
    expect(await registerItem("i")).toEqual({ kind: "unavailable" });
  });
});

describe("putSourceName", () => {
  it("sends the name, or null for the bank's", async () => {
    const put = vi.spyOn(apiClient, "put").mockResolvedValue(reply(204));
    expect(await putSourceName("a/b", "Conta")).toEqual({ kind: "ok" });
    expect(put).toHaveBeenCalledWith("/me/finance/sources/a%2Fb/name", { name: "Conta" });
    await putSourceName("s1", null);
    expect(put).toHaveBeenLastCalledWith("/me/finance/sources/s1/name", { name: null });
  });
  it("hands back the field codes of a 400, and falls back when the body has none", async () => {
    const put = vi.spyOn(apiClient, "put").mockResolvedValue(reply(400, { fields: { name: "too_long" } }));
    expect(await putSourceName("s1", "x")).toEqual({ kind: "fields", fields: { name: "too_long" } });
    put.mockResolvedValue(reply(400, "bad"));
    expect(await putSourceName("s1", "x")).toEqual({ kind: "error" });
    put.mockResolvedValue(reply(404));
    expect(await putSourceName("s1", "x")).toEqual({ kind: "error" });
  });
  it("reports a lost connection", async () => {
    vi.spyOn(apiClient, "put").mockRejectedValue(new Error("network"));
    expect(await putSourceName("s1", "x")).toEqual({ kind: "offline" });
  });
});
