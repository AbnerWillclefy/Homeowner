import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../auth/session";
import { acceptInvite, createInvite, lookupInvite } from "./api";

function stubStorage(signedIn: boolean) {
  const data = new Map<string, string>();
  if (signedIn) {
    data.set(SESSION_KEY, JSON.stringify({ idToken: "id-1", refreshToken: "rt-1", expiresAt: Date.now() + 3600_000 }));
  }
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
}

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const HOME = { id: "h1", timezone: "America/Sao_Paulo", allocationTime: "07:30" };

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("createInvite", () => {
  it("posts to /home/invites and returns the token and expiry", async () => {
    const fetch = stubFetch(Response.json({ token: "tok", expiresAt: "2026-10-18T10:00:00Z" }, { status: 201 }));
    expect(await createInvite()).toEqual({ kind: "ok", token: "tok", expiresAt: "2026-10-18T10:00:00Z" });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/invites");
    expect(fetch.mock.calls[0]![1]?.method).toBe("POST");
  });

  it("says when there are too many open Invites", async () => {
    stubFetch(Response.json({ error: "too many open invites" }, { status: 429 }));
    expect(await createInvite()).toEqual({ kind: "too-many" });
  });

  it("is none for a User with no Home", async () => {
    stubFetch(Response.json({ error: "no home" }, { status: 404 }));
    expect(await createInvite()).toEqual({ kind: "none" });
  });

  it("separates offline from other errors", async () => {
    stubFetch(new TypeError("network"));
    expect(await createInvite()).toEqual({ kind: "offline" });
    stubFetch(new Response("{}", { status: 500 }));
    expect(await createInvite()).toEqual({ kind: "error" });
  });
});

describe("lookupInvite", () => {
  it("is a GET with no Authorization header, so a signed-out person can use it", async () => {
    stubStorage(false);
    const fetch = stubFetch(Response.json({ valid: true }));
    expect(await lookupInvite("tok")).toEqual({ kind: "valid" });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/invites/tok");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).has("Authorization")).toBe(false);
  });

  it("reads 404 as not found and 410 as used or expired", async () => {
    stubFetch(Response.json({ error: "not found" }, { status: 404 }));
    expect(await lookupInvite("tok")).toEqual({ kind: "not-found" });
    stubFetch(Response.json({ error: "used" }, { status: 410 }));
    expect(await lookupInvite("tok")).toEqual({ kind: "used" });
    stubFetch(Response.json({ error: "expired" }, { status: 410 }));
    expect(await lookupInvite("tok")).toEqual({ kind: "expired" });
  });

  it("is offline when the API cannot be reached and error on anything unexpected", async () => {
    stubFetch(new TypeError("network"));
    expect(await lookupInvite("tok")).toEqual({ kind: "offline" });
    stubFetch(new Response("{}", { status: 500 }));
    expect(await lookupInvite("tok")).toEqual({ kind: "error" });
    stubFetch(Response.json({}, { status: 410 }));
    expect(await lookupInvite("tok")).toEqual({ kind: "error" });
  });
});

describe("acceptInvite", () => {
  it("posts the token and returns the Home joined", async () => {
    const fetch = stubFetch(Response.json(HOME));
    expect(await acceptInvite("tok", false)).toEqual({ kind: "ok", home: HOME });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/invites/tok/accept");
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({ confirmLeave: false });
  });

  it("sends confirmLeave when the person has agreed to leave", async () => {
    const fetch = stubFetch(Response.json(HOME));
    await acceptInvite("tok", true);
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({ confirmLeave: true });
  });

  it("tells a leave warning from an already-here conflict", async () => {
    stubFetch(Response.json({ error: "leaves current home" }, { status: 409 }));
    expect(await acceptInvite("tok", false)).toEqual({ kind: "would-leave" });
    stubFetch(Response.json({ error: "already_here" }, { status: 409 }));
    expect(await acceptInvite("tok", false)).toEqual({ kind: "already-here" });
    stubFetch(Response.json({ error: "already a resident" }, { status: 409 }));
    expect(await acceptInvite("tok", false)).toEqual({ kind: "error" });
  });

  it("reads 404 and 410 like the lookup", async () => {
    stubFetch(Response.json({ error: "not found" }, { status: 404 }));
    expect(await acceptInvite("tok", false)).toEqual({ kind: "not-found" });
    stubFetch(Response.json({ error: "used" }, { status: 410 }));
    expect(await acceptInvite("tok", false)).toEqual({ kind: "used" });
    stubFetch(Response.json({ error: "expired" }, { status: 410 }));
    expect(await acceptInvite("tok", false)).toEqual({ kind: "expired" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    stubFetch(Response.json(HOME));
    expect(await acceptInvite("tok", false)).toEqual({ kind: "not-signed-in" });
  });
});
