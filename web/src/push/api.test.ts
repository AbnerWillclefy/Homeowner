import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../auth/session";
import { getVapidPublicKey, saveSubscription } from "./api";

const sub = { endpoint: "https://push.example/abc", keys: { p256dh: "pk", auth: "au" } };

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function stubStorage(session: object | null) {
  const data = new Map<string, string>();
  if (session) data.set(SESSION_KEY, JSON.stringify(session));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
}

// Signed in by default; individual tests sign out.
beforeEach(() => stubStorage({ idToken: "id-1", refreshToken: "rt-1", expiresAt: Date.now() + 3600_000 }));
afterEach(() => vi.unstubAllGlobals());

function bearer(fetch: ReturnType<typeof stubFetch>): string | null {
  return new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization");
}

describe("getVapidPublicKey", () => {
  it("returns the key from the API", async () => {
    const fetch = stubFetch(Response.json({ key: "BKEY" }));
    expect(await getVapidPublicKey()).toEqual({ kind: "ok", key: "BKEY" });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/push/vapid-public-key");
  });

  it("reports push as not configured on 503", async () => {
    stubFetch(Response.json({ error: "push not configured" }, { status: 503 }));
    expect(await getVapidPublicKey()).toEqual({ kind: "not-configured" });
  });

  it("sends no Authorization header: the key is public", async () => {
    const fetch = stubFetch(Response.json({ key: "BKEY" }));
    await getVapidPublicKey();
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).has("Authorization")).toBe(false);
  });

  it("reports a network failure", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getVapidPublicKey()).toEqual({ kind: "error" });
  });

  it("reports an unexpected body as an error", async () => {
    stubFetch(Response.json({ nope: 1 }));
    expect(await getVapidPublicKey()).toEqual({ kind: "error" });
  });
});

describe("saveSubscription", () => {
  it("PUTs the subscription JSON with the user agent", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await saveSubscription(sub, "TestAgent/1")).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/push/subscription");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ ...sub, userAgent: "TestAgent/1" });
  });

  it("sends the bearer ID token", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    await saveSubscription(sub, "x");
    expect(bearer(fetch)).toBe("Bearer id-1");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Content-Type")).toBe("application/json");
  });

  it("reports not signed in, without calling the API, when there is no session", async () => {
    stubStorage(null);
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await saveSubscription(sub, "x")).toEqual({ kind: "not-signed-in" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports a rejected subscription as an error", async () => {
    stubFetch(Response.json({ error: "bad" }, { status: 400 }));
    expect(await saveSubscription(sub, "x")).toEqual({ kind: "error" });
  });

  it("reports a network failure", async () => {
    stubFetch(new TypeError("offline"));
    expect(await saveSubscription(sub, "x")).toEqual({ kind: "error" });
  });
});
