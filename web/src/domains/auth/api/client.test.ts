import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import type { RefreshResult } from "./cognito";
import { createApiClient, createAuthedRequest, errorCode } from "./client";
import { createTokenKeeper } from "../logic/tokenKeeper";
import { createSessionStore, type Session, type StorageLike } from "../logic/session";

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const NOW = 1_000_000;
const fresh: Session = { idToken: "id-1", refreshToken: "rt-1", expiresAt: NOW + 30 * 60_000 };
const nearExpiry: Session = { idToken: "id-old", refreshToken: "rt-1", expiresAt: NOW + 20_000 };

interface Call {
  url: string | undefined;
  auth: string | undefined;
}

/** Answers by the bearer it sees: tokens in `accepted` get 200, everything else 401, unless `status` is set. */
function setup(
  initial: Session | null,
  options: {
    accepted?: string[];
    status?: number;
    refresh?: RefreshResult | (() => Promise<RefreshResult>);
    adapterError?: Error;
  } = {},
) {
  const store = createSessionStore(memoryStorage(), () => NOW);
  if (initial) store.save(initial);
  const accepted = options.accepted ?? ["id-new"];

  const calls: Call[] = [];
  const sent: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const auth = config.headers.get("Authorization") as string | undefined;
    calls.push({ url: config.url, auth });
    sent.push(config);
    if (options.adapterError) throw options.adapterError;
    const token = auth?.replace("Bearer ", "");
    const status = options.status ?? (token && accepted.includes(token) ? 200 : 401);
    return { data: { ok: status === 200 }, status, statusText: "", headers: {}, config } as AxiosResponse;
  };

  const refresh = vi.fn(async (_rt: string): Promise<RefreshResult> => {
    const r = options.refresh;
    if (typeof r === "function") return r();
    return r ?? { kind: "ok", tokens: { idToken: "id-new", expiresInSeconds: 3600 } };
  });

  const client = createApiClient({
    keeper: createTokenKeeper({ session: store, refresh, now: () => NOW }),
    baseUrl: "http://api.test",
    adapter,
  });
  return { store, calls, sent, refresh, client, authedRequest: createAuthedRequest(client) };
}

describe("api client", () => {
  it("sends the bearer ID token to the base URL", async () => {
    const { authedRequest, calls, refresh } = setup(fresh, { accepted: ["id-1"] });
    const result = await authedRequest({ url: "/me" });
    expect(result.kind).toBe("response");
    expect(calls).toEqual([{ url: "/me", auth: "Bearer id-1" }]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps the caller's method, headers and body next to the bearer", async () => {
    const { authedRequest, sent } = setup(fresh, { accepted: ["id-1"] });
    await authedRequest({ url: "/me", method: "PUT", headers: { "X-Test": "1" }, data: "{}" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ method: "put", data: "{}" });
    expect(sent[0]!.headers.get("X-Test")).toBe("1");
    expect(sent[0]!.headers.get("Authorization")).toBe("Bearer id-1");
  });

  it("sends the old token when the refresh before the request cannot reach Cognito", async () => {
    const { authedRequest, calls, store } = setup(nearExpiry, { refresh: { kind: "network" }, accepted: ["id-old"] });
    const result = await authedRequest({ url: "/me" });
    expect(result).toMatchObject({ kind: "response", response: { status: 200 } });
    expect(calls).toEqual([{ url: "/me", auth: "Bearer id-old" }]);
    expect(store.load()).toEqual(nearExpiry);
  });

  it("is not signed in, and sends nothing, without a session", async () => {
    const { authedRequest, calls } = setup(null);
    expect(await authedRequest({ url: "/me" })).toEqual({ kind: "not-signed-in" });
    expect(calls).toEqual([]);
  });

  it("refreshes before the request when the token is near expiry", async () => {
    const { authedRequest, calls, refresh, store } = setup(nearExpiry);
    const result = await authedRequest({ url: "/me" });
    expect(refresh).toHaveBeenCalledExactlyOnceWith("rt-1");
    expect(calls).toEqual([{ url: "/me", auth: "Bearer id-new" }]);
    expect(result.kind).toBe("response");
    expect(store.load()?.idToken).toBe("id-new");
  });

  it("is not signed in when Cognito rejects the refresh before the request", async () => {
    const { authedRequest, calls } = setup(nearExpiry, { refresh: { kind: "not-authorized" } });
    expect(await authedRequest({ url: "/me" })).toEqual({ kind: "not-signed-in" });
    expect(calls).toEqual([]);
  });

  it("refreshes once and retries once on a 401", async () => {
    const { authedRequest, calls, refresh } = setup(fresh);
    const result = await authedRequest({ url: "/me" });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.auth)).toEqual(["Bearer id-1", "Bearer id-new"]);
    expect(result).toMatchObject({ kind: "response", response: { status: 200 } });
  });

  it("shares one refresh between parallel 401s", async () => {
    let release: (r: RefreshResult) => void = () => {};
    const { authedRequest, calls, refresh } = setup(fresh, {
      refresh: () => new Promise<RefreshResult>((resolve) => (release = resolve)),
    });
    const results = Promise.all([1, 2, 3].map((i) => authedRequest({ url: `/x${i}` })));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    release({ kind: "ok", tokens: { idToken: "id-new", expiresInSeconds: 3600 } });
    const all = await results;
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(all.every((r) => r.kind === "response" && r.response.status === 200)).toBe(true);
    expect(calls).toHaveLength(6);
  });

  it("clears the session and is not signed in when the 401 survives the fresh token", async () => {
    const { authedRequest, calls, store } = setup(fresh, { accepted: [] });
    expect(await authedRequest({ url: "/me" })).toEqual({ kind: "not-signed-in" });
    expect(calls).toHaveLength(2);
    expect(store.load()).toBeNull();
  });

  it("is not signed in when Cognito rejects the refresh after a 401", async () => {
    const { authedRequest, calls, store } = setup(fresh, { refresh: { kind: "not-authorized" } });
    expect(await authedRequest({ url: "/me" })).toEqual({ kind: "not-signed-in" });
    expect(calls).toHaveLength(1);
    expect(store.load()).toBeNull();
  });

  it("hands back the 401 and keeps the session when Cognito is unreachable", async () => {
    const { authedRequest, calls, store } = setup(fresh, { refresh: { kind: "network" } });
    const result = await authedRequest({ url: "/me" });
    expect(result).toMatchObject({ kind: "response", response: { status: 401 } });
    expect(calls).toHaveLength(1);
    expect(store.load()).toEqual(fresh);
  });

  it("passes a 500 through with no refresh", async () => {
    const { authedRequest, refresh } = setup(fresh, { status: 500 });
    const result = await authedRequest({ url: "/me" });
    expect(result).toMatchObject({ kind: "response", response: { status: 500 } });
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each(["https://evil.test/x", "//evil.test/x", "HTTP://evil.test/x", "mailto:a@b.c"])(
    "refuses the absolute URL %s: no request, no token",
    async (url) => {
      const { client, calls } = setup(fresh);
      await expect(client.request({ url })).rejects.toThrow(/absolute/i);
      expect(calls).toEqual([]);
    },
  );

  it("refuses an absolute URL before refreshing a token near expiry", async () => {
    const { client, calls, refresh } = setup(nearExpiry);
    await expect(client.request({ url: "https://evil.test/x" })).rejects.toThrow(/absolute/i);
    expect(refresh).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("lets a network failure reach the caller", async () => {
    const { authedRequest } = setup(fresh, { adapterError: new Error("Network Error") });
    await expect(authedRequest({ url: "/me" })).rejects.toThrow("Network Error");
  });
});

describe("errorCode", () => {
  const body = (data: unknown) => ({ data }) as AxiosResponse;
  it("reads the error code of an API error body", () => {
    expect(errorCode(body({ error: "conflict" }))).toBe("conflict");
  });
  it("is null for anything else", () => {
    expect(errorCode(body("<html>"))).toBeNull();
    expect(errorCode(body(null))).toBeNull();
    expect(errorCode(body({ error: 3 }))).toBeNull();
  });
});
