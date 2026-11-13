import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotSignedIn } from "../../api/client";
import { deleteCredentials, deleteFinanceData, deleteSubscription, getVapidPublicKey, putCredentials, putIncome, saveSubscription } from "./api";

const request = vi.fn<(config: { method: string; url: string; data?: unknown }) => Promise<{ status: number; data?: unknown }>>();
const get = vi.fn<(url: string) => Promise<{ status: number; data?: unknown }>>();
const put = vi.fn<(url: string, data: unknown) => Promise<{ status: number }>>();
vi.mock("../../api/client", async (original) => ({
  ...(await original<typeof import("../../api/client")>()),
  apiClient: { request: (c: never) => request(c), get: (u: string) => get(u), put: (u: string, d: unknown) => put(u, d) },
}));

beforeEach(() => {
  for (const fn of [request, get, put]) fn.mockReset();
});

describe("income and data", () => {
  it("PUTs the income, and null clears it", async () => {
    request.mockResolvedValue({ status: 204 });
    expect(await putIncome(500000)).toEqual({ kind: "ok" });
    expect(request).toHaveBeenCalledWith({ method: "PUT", url: "/me/finance/income", data: { monthlyIncomeCents: 500000 } });
    await putIncome(null);
    expect(request).toHaveBeenLastCalledWith({ method: "PUT", url: "/me/finance/income", data: { monthlyIncomeCents: null } });
  });

  it("reports a refused income as an error", async () => {
    request.mockResolvedValue({ status: 500 });
    expect(await putIncome(1)).toEqual({ kind: "error" });
  });

  it("DELETEs /me/finance and the credentials", async () => {
    request.mockResolvedValue({ status: 204 });
    expect(await deleteFinanceData()).toEqual({ kind: "ok" });
    expect(request).toHaveBeenCalledWith({ method: "DELETE", url: "/me/finance", data: undefined });
    await deleteCredentials();
    expect(request).toHaveBeenLastCalledWith({ method: "DELETE", url: "/me/finance/credentials", data: undefined });
  });

  it("reads the credentials answers", async () => {
    put.mockResolvedValueOnce({ status: 204 }).mockResolvedValueOnce({ status: 400 }).mockResolvedValueOnce({ status: 422 }).mockResolvedValueOnce({ status: 502 });
    expect(await putCredentials("id", "secret")).toEqual({ kind: "ok" });
    expect(put).toHaveBeenCalledWith("/me/finance/credentials", { clientId: "id", clientSecret: "secret" });
    expect((await putCredentials("a", "b")).kind).toBe("invalid");
    expect((await putCredentials("a", "b")).kind).toBe("rejected");
    expect((await putCredentials("a", "b")).kind).toBe("error");
  });
});

describe("push", () => {
  const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "pk", auth: "au" } };

  it("reads the key, and 503 as not configured", async () => {
    get.mockResolvedValueOnce({ status: 200, data: { key: "BKEY" } }).mockResolvedValueOnce({ status: 503 }).mockResolvedValueOnce({ status: 200, data: {} });
    expect(await getVapidPublicKey()).toEqual({ kind: "ok", key: "BKEY" });
    expect(get).toHaveBeenCalledWith("/push/vapid-public-key");
    expect(await getVapidPublicKey()).toEqual({ kind: "not-configured" });
    expect(await getVapidPublicKey()).toEqual({ kind: "error" });
  });

  it("PUTs the subscription with app revenue", async () => {
    request.mockResolvedValue({ status: 204 });
    expect(await saveSubscription(sub, "UA/1")).toEqual({ kind: "ok" });
    expect(request).toHaveBeenCalledWith({ url: "/push/subscription", method: "PUT", data: { endpoint: sub.endpoint, keys: sub.keys, userAgent: "UA/1", app: "revenue" } });
  });

  it("DELETEs the subscription by endpoint", async () => {
    request.mockResolvedValue({ status: 204 });
    expect(await deleteSubscription(sub.endpoint)).toEqual({ kind: "ok" });
    expect(request).toHaveBeenCalledWith({ url: "/push/subscription", method: "DELETE", data: { endpoint: sub.endpoint } });
  });

  it("tells a lost session from a failure, and 403 or 503 are errors", async () => {
    request.mockRejectedValueOnce(new NotSignedIn()).mockResolvedValueOnce({ status: 403 }).mockRejectedValueOnce(new Error("net"));
    expect(await saveSubscription(sub, "UA")).toEqual({ kind: "not-signed-in" });
    expect(await saveSubscription(sub, "UA")).toEqual({ kind: "error" });
    expect(await deleteSubscription(sub.endpoint)).toEqual({ kind: "error" });
  });
});
