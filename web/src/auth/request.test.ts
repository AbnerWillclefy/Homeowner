import { describe, expect, it, vi } from "vitest";
import type { RefreshResult } from "./cognito";
import { createSessionStore, type Session, type StorageLike } from "./session";
import { createAuthedFetch } from "./request";

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

function setup(initial: Session | null, responder?: (req: { url: string; auth: string | null }) => Response) {
  const store = createSessionStore(memoryStorage(), () => NOW);
  if (initial) store.save(initial);

  const calls: { url: string; auth: string | null; method?: string }[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get("Authorization");
    calls.push({ url: String(url), auth, method: init?.method });
    return responder ? responder({ url: String(url), auth }) : new Response(null, { status: 204 });
  });

  const refresh = vi.fn(
    async (_rt: string): Promise<RefreshResult> => ({
      kind: "ok",
      tokens: { idToken: "id-new", expiresInSeconds: 3600 },
    }),
  );

  const authedFetch = createAuthedFetch({
    session: store,
    refresh,
    fetch: fetchFn as unknown as typeof fetch,
    now: () => NOW,
    baseUrl: "http://api.test",
  });
  return { store, calls, refresh, authedFetch };
}

describe("authedFetch", () => {
  it("attaches the bearer ID token and keeps the caller's headers and body", async () => {
    const { authedFetch, calls } = setup(fresh);
    const result = await authedFetch("/me", { method: "PUT", headers: { "X-Test": "1" }, body: "{}" });
    expect(result.kind).toBe("response");
    expect(calls).toEqual([{ url: "http://api.test/me", auth: "Bearer id-1", method: "PUT" }]);
  });

  it("is not signed in, and makes no request, without a session", async () => {
    const { authedFetch, calls } = setup(null);
    expect(await authedFetch("/me")).toEqual({ kind: "not-signed-in" });
    expect(calls).toEqual([]);
  });

  it("does not refresh a token with plenty of life left", async () => {
    const { authedFetch, refresh } = setup(fresh);
    await authedFetch("/me");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes first when the token expires within about a minute, and stores the result", async () => {
    const { authedFetch, refresh, calls, store } = setup(nearExpiry);
    await authedFetch("/me");
    expect(refresh).toHaveBeenCalledExactlyOnceWith("rt-1");
    expect(calls[0]!.auth).toBe("Bearer id-new");
    expect(store.load()).toEqual({ idToken: "id-new", refreshToken: "rt-1", expiresAt: NOW + 3600_000 });
  });

  it("keeps a rotated refresh token", async () => {
    const { authedFetch, refresh, store } = setup(nearExpiry);
    refresh.mockResolvedValueOnce({
      kind: "ok",
      tokens: { idToken: "id-new", refreshToken: "rt-2", expiresInSeconds: 60 },
    });
    await authedFetch("/me");
    expect(store.load()?.refreshToken).toBe("rt-2");
  });

  it("on a 401 refreshes once and retries once", async () => {
    const { authedFetch, refresh, calls } = setup(fresh, ({ auth }) =>
      auth === "Bearer id-new" ? new Response(null, { status: 204 }) : new Response(null, { status: 401 }),
    );
    const result = await authedFetch("/me");
    expect(result.kind === "response" && result.response.status).toBe(204);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.auth)).toEqual(["Bearer id-1", "Bearer id-new"]);
  });

  it("signs out when the retry is still a 401", async () => {
    const { authedFetch, refresh, calls, store } = setup(fresh, () => new Response(null, { status: 401 }));
    expect(await authedFetch("/me")).toEqual({ kind: "not-signed-in" });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
    expect(store.load()).toBeNull();
  });

  it("signs out when Cognito rejects the refresh token", async () => {
    const { authedFetch, refresh, calls, store } = setup(fresh, () => new Response(null, { status: 401 }));
    refresh.mockResolvedValueOnce({ kind: "not-authorized" });
    expect(await authedFetch("/me")).toEqual({ kind: "not-signed-in" });
    expect(calls).toHaveLength(1);
    expect(store.load()).toBeNull();
  });

  it("signs out when the refresh before the request is rejected, without calling the API", async () => {
    const { authedFetch, refresh, calls, store } = setup(nearExpiry);
    refresh.mockResolvedValueOnce({ kind: "not-authorized" });
    expect(await authedFetch("/me")).toEqual({ kind: "not-signed-in" });
    expect(calls).toEqual([]);
    expect(store.load()).toBeNull();
  });

  it("stays signed in when the refresh cannot reach Cognito", async () => {
    const { authedFetch, refresh, store, calls } = setup(nearExpiry);
    refresh.mockResolvedValueOnce({ kind: "network" });
    const result = await authedFetch("/me");
    expect(result.kind).toBe("response");
    expect(calls[0]!.auth).toBe("Bearer id-old");
    expect(store.load()).toEqual(nearExpiry);
  });

  it("hands back the 401 and stays signed in when the refresh after it cannot reach Cognito", async () => {
    const { authedFetch, refresh, store } = setup(fresh, () => new Response(null, { status: 401 }));
    refresh.mockResolvedValueOnce({ kind: "network" });
    const result = await authedFetch("/me");
    expect(result.kind === "response" && result.response.status).toBe(401);
    expect(store.load()).toEqual(fresh);
  });

  it("passes other statuses through untouched", async () => {
    const { authedFetch, refresh } = setup(fresh, () => new Response(null, { status: 500 }));
    const result = await authedFetch("/me");
    expect(result.kind === "response" && result.response.status).toBe(500);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("lets a network failure of the API call reach the caller", async () => {
    const store = createSessionStore(memoryStorage(), () => NOW);
    store.save(fresh);
    const authedFetch = createAuthedFetch({
      session: store,
      refresh: vi.fn(),
      fetch: (async () => {
        throw new TypeError("offline");
      }) as unknown as typeof fetch,
      now: () => NOW,
      baseUrl: "http://api.test",
    });
    await expect(authedFetch("/me")).rejects.toThrow("offline");
    expect(store.load()).toEqual(fresh);
  });

  it("shares one refresh between parallel requests", async () => {
    const { authedFetch, refresh, calls } = setup(nearExpiry);
    let release!: (r: RefreshResult) => void;
    refresh.mockReturnValueOnce(new Promise<RefreshResult>((resolve) => (release = resolve)));
    const all = Promise.all([authedFetch("/a"), authedFetch("/b"), authedFetch("/c")]);
    await Promise.resolve();
    release({ kind: "ok", tokens: { idToken: "id-new", expiresInSeconds: 3600 } });
    await all;
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.auth)).toEqual(["Bearer id-new", "Bearer id-new", "Bearer id-new"]);
  });

  it("shares one refresh between parallel 401s", async () => {
    const { authedFetch, refresh } = setup(fresh, ({ auth }) =>
      auth === "Bearer id-new" ? new Response(null, { status: 204 }) : new Response(null, { status: 401 }),
    );
    const results = await Promise.all([authedFetch("/a"), authedFetch("/b")]);
    expect(results.map((r) => r.kind === "response" && r.response.status)).toEqual([204, 204]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
