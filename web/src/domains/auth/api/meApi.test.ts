import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../logic/session";
import { getMe } from "./meApi";

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

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("getMe", () => {
  it("is an error when a 200 carries a body that is not JSON", async () => {
    stubFetch(new Response("<html>", { status: 200 }));
    expect(await getMe()).toEqual({ kind: "error" });
  });

  it("returns the signed-in User from GET /me", async () => {
    const fetch = stubFetch(Response.json({ id: "u1", email: "a@example.com", name: "a" }));
    expect(await getMe()).toEqual({
      kind: "ok",
      id: "u1",
      email: "a@example.com",
      displayName: null,
      name: "a",
      photoUrl: null,
      initials: "",
      avatarTone: "",
    });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/me");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("reads the display name, the shown name, the photo and the avatar fallback", async () => {
    stubFetch(
      Response.json({
        id: "u1",
        email: "a@example.com",
        displayName: "Abner",
        name: "Abner",
        photoUrl: "https://cdn.test/u1.jpg",
        initials: "A",
        avatarTone: "pets",
      }),
    );
    expect(await getMe()).toEqual({
      kind: "ok",
      id: "u1",
      email: "a@example.com",
      displayName: "Abner",
      name: "Abner",
      photoUrl: "https://cdn.test/u1.jpg",
      initials: "A",
      avatarTone: "pets",
    });
  });

  it("reads absent optional fields as null", async () => {
    stubFetch(Response.json({ id: "u1", email: "abner.w@example.com", displayName: "  ", name: "abner.w", photoUrl: 3 }));
    expect(await getMe()).toMatchObject({ name: "abner.w", displayName: null, photoUrl: null });
  });

  it("is an error when the API sends no shown name", async () => {
    stubFetch(Response.json({ id: "u1", email: "a@example.com", name: " " }));
    expect(await getMe()).toEqual({ kind: "error" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    stubFetch(Response.json({}));
    expect(await getMe()).toEqual({ kind: "not-signed-in" });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getMe()).toEqual({ kind: "offline" });
  });

  it("is an error for a server failure or an unexpected body", async () => {
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await getMe()).toEqual({ kind: "error" });
    stubFetch(Response.json({ nope: 1 }));
    expect(await getMe()).toEqual({ kind: "error" });
  });

  it("is an error when auth is not configured on the API (503)", async () => {
    stubFetch(Response.json({ error: "auth not configured" }, { status: 503 }));
    expect(await getMe()).toEqual({ kind: "error" });
  });
});
