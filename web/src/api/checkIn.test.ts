import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../auth/session";
import { getCheckIn, putCheckIn } from "./checkIn";

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

const MISSING = { date: "2026-10-12", checkedIn: false, level: null, restrictions: [] };
const LOW = { date: "2026-10-12", checkedIn: true, level: "low", restrictions: ["bending", "heights"] };

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("getCheckIn", () => {
  it("reads today's Check-in from GET /home/check-in", async () => {
    const fetch = stubFetch(Response.json(LOW));
    expect(await getCheckIn()).toEqual({ kind: "ok", checkIn: LOW });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/check-in");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("reads a day with no Check-in: not checked in, no level", async () => {
    stubFetch(Response.json(MISSING));
    expect(await getCheckIn()).toEqual({ kind: "ok", checkIn: MISSING });
  });

  it("treats restrictions the API sends as null as empty", async () => {
    stubFetch(Response.json({ ...MISSING, restrictions: null }));
    expect(await getCheckIn()).toEqual({ kind: "ok", checkIn: MISSING });
  });

  it("is an error for a body it cannot read", async () => {
    const bodies: unknown[] = [
      { ...LOW, level: "sleepy" },
      { ...LOW, checkedIn: "yes" },
      { ...LOW, restrictions: [1] },
      { ...LOW, date: 5 },
      { ...MISSING, checkedIn: true },
      "nope",
    ];
    for (const body of bodies) {
      stubFetch(Response.json(body));
      expect(await getCheckIn()).toEqual({ kind: "error" });
    }
  });

  it("is none when the User has no Home (404)", async () => {
    stubFetch(new Response("", { status: 404 }));
    expect(await getCheckIn()).toEqual({ kind: "none" });
  });

  it("is an error for a server failure", async () => {
    stubFetch(new Response("", { status: 500 }));
    expect(await getCheckIn()).toEqual({ kind: "error" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    stubFetch(Response.json(LOW));
    expect(await getCheckIn()).toEqual({ kind: "not-signed-in" });
  });

  it("is offline when the request cannot be made", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getCheckIn()).toEqual({ kind: "offline" });
  });
});

describe("putCheckIn", () => {
  it("sends the level and the day's Restrictions to PUT /home/check-in", async () => {
    const fetch = stubFetch(Response.json(LOW));
    expect(await putCheckIn("low", ["bending", "heights"])).toEqual({ kind: "ok", checkIn: LOW });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/home/check-in");
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({ level: "low", restrictions: ["bending", "heights"] });
  });

  it("sends an empty list when nothing is ticked", async () => {
    const fetch = stubFetch(Response.json({ ...LOW, restrictions: [] }));
    await putCheckIn("normal", []);
    expect(JSON.parse(fetch.mock.calls[0]![1]?.body as string)).toEqual({ level: "normal", restrictions: [] });
  });

  it("is invalid when the API refuses the values (400)", async () => {
    stubFetch(new Response(JSON.stringify({ error: "level must be one of" }), { status: 400 }));
    expect(await putCheckIn("low", [])).toEqual({ kind: "invalid" });
  });

  it("is an error for a server failure or an unreadable answer", async () => {
    stubFetch(new Response("", { status: 500 }));
    expect(await putCheckIn("low", [])).toEqual({ kind: "error" });
    stubFetch(Response.json({ nope: true }));
    expect(await putCheckIn("low", [])).toEqual({ kind: "error" });
  });

  it("is none when the User has no Home (404)", async () => {
    stubFetch(new Response("", { status: 404 }));
    expect(await putCheckIn("low", [])).toEqual({ kind: "none" });
  });

  it("is not signed in without a session, and offline when the request cannot be made", async () => {
    stubStorage(false);
    stubFetch(Response.json(LOW));
    expect(await putCheckIn("low", [])).toEqual({ kind: "not-signed-in" });
    stubStorage(true);
    stubFetch(new TypeError("Failed to fetch"));
    expect(await putCheckIn("low", [])).toEqual({ kind: "offline" });
  });
});
