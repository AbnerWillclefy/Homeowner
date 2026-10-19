import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../auth/logic/session";
import { getResidents } from "./api";

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

const ROW = { residentId: "r1", userId: "u1", name: "Abner", photoUrl: "https://cdn.test/u1.jpg", me: true };

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("getResidents", () => {
  it("reads the Residents from GET /home/residents", async () => {
    const fetch = stubFetch(Response.json([ROW]));
    expect(await getResidents()).toEqual({ kind: "ok", residents: [ROW] });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/residents");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("treats a missing or odd photoUrl as null", async () => {
    const { photoUrl: _drop, ...noPhoto } = ROW;
    stubFetch(Response.json([noPhoto, { ...ROW, residentId: "r2", photoUrl: 7 }, { ...ROW, residentId: "r3", photoUrl: "" }]));
    const result = await getResidents();
    expect(result.kind === "ok" && result.residents.map((r) => r.photoUrl)).toEqual([null, null, null]);
  });

  it("drops malformed rows and keeps the good ones", async () => {
    stubFetch(
      Response.json([
        null,
        "x",
        { ...ROW, residentId: 1 },
        { ...ROW, residentId: "r2", userId: undefined },
        { ...ROW, residentId: "r3", name: 5 },
        { ...ROW, residentId: "r4", me: "yes" },
        { ...ROW, residentId: "r5", me: false },
      ]),
    );
    const result = await getResidents();
    expect(result.kind === "ok" && result.residents.map((r) => r.residentId)).toEqual(["r5"]);
  });

  it("is an empty list for an empty array and an error when the body is not an array", async () => {
    stubFetch(Response.json([]));
    expect(await getResidents()).toEqual({ kind: "ok", residents: [] });
    stubFetch(Response.json({ residents: [] }));
    expect(await getResidents()).toEqual({ kind: "error" });
  });

  it("is none for 404 (no Home)", async () => {
    stubFetch(Response.json({ error: "no home" }, { status: 404 }));
    expect(await getResidents()).toEqual({ kind: "none" });
  });

  it("is an error for a server failure", async () => {
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await getResidents()).toEqual({ kind: "error" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    stubFetch(Response.json([]));
    expect(await getResidents()).toEqual({ kind: "not-signed-in" });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getResidents()).toEqual({ kind: "offline" });
  });
});
