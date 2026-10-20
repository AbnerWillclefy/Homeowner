import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../auth/logic/session";
import { getResident, getResidents } from "./api";

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

const COMPLETION = {
  id: "c1",
  choreId: "ch1",
  choreName: "Clean the stove",
  category: "kitchen",
  completedAt: "2026-10-19T12:30:00Z",
  with: [{ id: "r2", name: "Bruna" }],
};
const DETAIL = {
  date: "2026-10-19",
  id: "r1",
  you: false,
  name: "Ana",
  photoUrl: null,
  initials: "A",
  avatarTone: "mint",
  streak: 11,
  doneLast7Days: 2,
  days: [{ date: "2026-10-19", completions: [COMPLETION, { ...COMPLETION, id: "c2", with: [] }] }],
};

describe("getResident", () => {
  it("reads the header, the counts and the days as the API sends them", async () => {
    const fetch = stubFetch(Response.json(DETAIL));
    const result = await getResident("r1");
    expect(fetch.mock.calls[0]![0]).toMatch(/\/home\/residents\/r1$/);
    expect(result).toEqual({
      kind: "ok",
      resident: {
        date: "2026-10-19",
        id: "r1",
        you: false,
        name: "Ana",
        photoUrl: null,
        initials: "A",
        avatarTone: "mint",
        streak: 11,
        doneLast7Days: 2,
        days: [
          {
            date: "2026-10-19",
            completions: [
              { id: "c1", choreName: "Clean the stove", category: "kitchen", completedAt: "2026-10-19T12:30:00Z", with: [{ id: "r2", name: "Bruna" }] },
              { id: "c2", choreName: "Clean the stove", category: "kitchen", completedAt: "2026-10-19T12:30:00Z", with: [] },
            ],
          },
        ],
      },
    });
  });

  it("encodes the id into the path", async () => {
    const fetch = stubFetch(Response.json(DETAIL));
    await getResident("a/b");
    expect(fetch.mock.calls[0]![0]).toMatch(/\/home\/residents\/a%2Fb$/);
  });

  it("reads no days as an empty list", async () => {
    stubFetch(Response.json({ ...DETAIL, doneLast7Days: 0, days: [] }));
    const result = await getResident("r1");
    expect(result.kind === "ok" && result.resident.days).toEqual([]);
  });

  it("keeps a photo URL and reads a blank one as null", async () => {
    stubFetch(Response.json({ ...DETAIL, photoUrl: "https://cdn.test/a.jpg" }));
    const withPhoto = await getResident("r1");
    expect(withPhoto.kind === "ok" && withPhoto.resident.photoUrl).toBe("https://cdn.test/a.jpg");
    stubFetch(Response.json({ ...DETAIL, photoUrl: "" }));
    const blank = await getResident("r1");
    expect(blank.kind === "ok" && blank.resident.photoUrl).toBeNull();
  });

  it.each([
    ["days is not an array", { ...DETAIL, days: {} }],
    ["a day without a date", { ...DETAIL, days: [{ completions: [] }] }],
    ["a day without completions", { ...DETAIL, days: [{ date: "2026-10-19" }] }],
    ["with is not an array", { ...DETAIL, days: [{ date: "2026-10-19", completions: [{ ...COMPLETION, with: null }] }] }],
    ["a partner without a name", { ...DETAIL, days: [{ date: "2026-10-19", completions: [{ ...COMPLETION, with: [{ id: "r2" }] }] }] }],
    ["completedAt is not a date", { ...DETAIL, days: [{ date: "2026-10-19", completions: [{ ...COMPLETION, completedAt: "later" }] }] }],
    ["a Completion without a Chore name", { ...DETAIL, days: [{ date: "2026-10-19", completions: [{ ...COMPLETION, choreName: 3 }] }] }],
    ["a negative Streak", { ...DETAIL, streak: -1 }],
    ["a fractional count", { ...DETAIL, doneLast7Days: 1.5 }],
    ["a missing date", { ...DETAIL, date: undefined }],
    ["a missing name", { ...DETAIL, name: undefined }],
    ["you is not a boolean", { ...DETAIL, you: "no" }],
    ["a body that is not an object", [DETAIL]],
  ])("is an error when %s", async (_name, body) => {
    stubFetch(Response.json(body));
    expect(await getResident("r1")).toEqual({ kind: "error" });
  });

  it("is not-found for 404 resident not found", async () => {
    stubFetch(Response.json({ error: "resident not found" }, { status: 404 }));
    expect(await getResident("r1")).toEqual({ kind: "not-found" });
  });

  it("is none for 404 no home, told apart by the error code", async () => {
    stubFetch(Response.json({ error: "no home" }, { status: 404 }));
    expect(await getResident("r1")).toEqual({ kind: "none" });
  });

  it("is not-found for a 404 whose body is unreadable", async () => {
    stubFetch(new Response("<html>", { status: 404 }));
    expect(await getResident("r1")).toEqual({ kind: "not-found" });
  });

  it("is an error for a server failure", async () => {
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await getResident("r1")).toEqual({ kind: "error" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    stubFetch(Response.json(DETAIL));
    expect(await getResident("r1")).toEqual({ kind: "not-signed-in" });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getResident("r1")).toEqual({ kind: "offline" });
  });
});
