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

const ROW = {
  id: "r1",
  you: true,
  name: "Abner",
  photoUrl: "https://cdn.test/u1.jpg",
  initials: "A",
  avatarTone: "kitchen",
  streak: 3,
  doneToday: 2,
};
const body = (residents: unknown[]) => ({ date: "2026-10-19", residents });

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("getResidents", () => {
  it("reads the date and the Residents from GET /home/residents", async () => {
    const fetch = stubFetch(Response.json(body([ROW])));
    expect(await getResidents()).toEqual({ kind: "ok", date: "2026-10-19", residents: [ROW] });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/residents");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("treats a missing or odd photoUrl as null", async () => {
    const { photoUrl: _drop, ...noPhoto } = ROW;
    stubFetch(
      Response.json(body([noPhoto, { ...ROW, id: "r2", photoUrl: 7 }, { ...ROW, id: "r3", photoUrl: "" }, { ...ROW, id: "r4", photoUrl: null }])),
    );
    const result = await getResidents();
    expect(result.kind === "ok" && result.residents.map((r) => r.photoUrl)).toEqual([null, null, null, null]);
  });

  it("reads a missing or odd Streak and count as 0, and a missing avatar as empty", async () => {
    const { streak: _s, doneToday: _d, initials: _i, avatarTone: _t, ...bare } = ROW;
    stubFetch(Response.json(body([bare, { ...ROW, id: "r2", streak: -1, doneToday: "2" }])));
    const result = await getResidents();
    expect(result.kind === "ok" && result.residents.map((r) => [r.streak, r.doneToday, r.initials, r.avatarTone])).toEqual([
      [0, 0, "", ""],
      [0, 0, "A", "kitchen"],
    ]);
  });

  it("drops malformed rows and keeps the good ones", async () => {
    stubFetch(
      Response.json(
        body([
          null,
          "x",
          { ...ROW, id: 1 },
          { ...ROW, id: "r2", you: undefined },
          { ...ROW, id: "r3", name: 5 },
          { ...ROW, id: "r4", you: "yes" },
          { ...ROW, id: "r5", you: false },
        ]),
      ),
    );
    const result = await getResidents();
    expect(result.kind === "ok" && result.residents.map((r) => r.id)).toEqual(["r5"]);
  });

  it("is an empty list for no Residents and an error when the body is not the envelope", async () => {
    stubFetch(Response.json(body([])));
    expect(await getResidents()).toEqual({ kind: "ok", date: "2026-10-19", residents: [] });
    stubFetch(Response.json([ROW]));
    expect(await getResidents()).toEqual({ kind: "error" });
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
    stubFetch(Response.json(body([])));
    expect(await getResidents()).toEqual({ kind: "not-signed-in" });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getResidents()).toEqual({ kind: "offline" });
  });
});
