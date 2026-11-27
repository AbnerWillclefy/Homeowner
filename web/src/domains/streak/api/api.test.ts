import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../auth/logic/session";
import { getStreak } from "./api";

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

const BODY = { date: "2026-10-12", current: 3, todayGrew: true };

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("getStreak", () => {
  it("is an error when a 200 carries a body that is not JSON", async () => {
    stubFetch(new Response("<html>", { status: 200 }));
    expect(await getStreak()).toEqual({ kind: "error" });
  });

  it("reads the current Streak from GET /home/streak", async () => {
    const fetch = stubFetch(Response.json(BODY));
    expect(await getStreak()).toEqual({ kind: "ok", streak: { current: 3, todayGrew: true } });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/streak");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("reads a Streak of 0", async () => {
    stubFetch(Response.json({ ...BODY, current: 0, todayGrew: false }));
    expect(await getStreak()).toEqual({ kind: "ok", streak: { current: 0, todayGrew: false } });
  });

  describe("week", () => {
    const STATES = ["grew", "paused", "broken", "open"] as const;
    const WEEK = Array.from({ length: 7 }, (_, i) => ({ date: `2030-01-${String(9 + i).padStart(2, "0")}`, state: STATES[i % 4]! }));

    it("keeps exactly seven well-formed days", async () => {
      stubFetch(Response.json({ ...BODY, week: WEEK }));
      expect(await getStreak()).toEqual({ kind: "ok", streak: { current: 3, todayGrew: true, week: WEEK } });
    });

    it.each([
      ["absent", undefined],
      ["null", null],
      ["six days", WEEK.slice(0, 6)],
      ["eight days", [...WEEK, WEEK[0]]],
      ["an unknown state", WEEK.map((d, i) => (i === 3 ? { ...d, state: "sleeping" } : d))],
      ["a date that is not YYYY-MM-DD", WEEK.map((d, i) => (i === 3 ? { ...d, date: "today" } : d))],
      ["an entry that is not an object", WEEK.map((d, i) => (i === 3 ? "grew" : d))],
      ["not a list", { 0: WEEK[0] }],
    ])("drops a week that is %s and keeps the Streak", async (_name, week) => {
      stubFetch(Response.json({ ...BODY, week }));
      expect(await getStreak()).toEqual({ kind: "ok", streak: { current: 3, todayGrew: true } });
    });
  });

  it("is an error for a body it cannot read", async () => {
    const bodies: unknown[] = [
      { ...BODY, current: -1 },
      { ...BODY, current: 1.5 },
      { ...BODY, current: "3" },
      { ...BODY, current: null },
      { ...BODY, todayGrew: "yes" },
      { current: 3 },
      "nope",
      null,
    ];
    for (const body of bodies) {
      stubFetch(Response.json(body));
      expect(await getStreak(), JSON.stringify(body)).toEqual({ kind: "error" });
    }
  });

  it("is none when the User has no Home", async () => {
    stubFetch(Response.json({ error: "no home" }, { status: 404 }));
    expect(await getStreak()).toEqual({ kind: "none" });
  });

  it("is an error for any other status", async () => {
    stubFetch(new Response("boom", { status: 500 }));
    expect(await getStreak()).toEqual({ kind: "error" });
  });

  it("is offline when the request cannot be made", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getStreak()).toEqual({ kind: "offline" });
  });

  it("is not-signed-in without a session", async () => {
    stubStorage(false);
    const fetch = stubFetch(Response.json(BODY));
    expect(await getStreak()).toEqual({ kind: "not-signed-in" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
