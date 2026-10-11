import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../auth/session";
import { getDayPlan } from "./dayPlan";

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

const TASK = {
  id: "t1",
  choreId: "c1",
  choreName: "Wash dishes",
  windowStart: "2026-10-11",
  windowEnd: "2026-10-12",
  currentEffort: 3,
  baseEffort: 2,
  people: 1,
  importance: "normal",
};

const PLAN = {
  date: "2026-10-11",
  allocationTime: "07:00",
  planned: true,
  rejected: false,
  allocator: "baseline",
  energy: 5,
  mine: [{ ...TASK, reason: "fits_energy" }],
  others: [{ residentId: "r2", tasks: [{ ...TASK, id: "t2", reason: "deadline_today" }] }],
  pool: [{ ...TASK, id: "t3", reason: "no_energy_left" }],
};

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("getDayPlan", () => {
  it("returns today's Day Plan from GET /home/day-plan", async () => {
    const fetch = stubFetch(Response.json(PLAN));
    expect(await getDayPlan()).toEqual({ kind: "ok", plan: PLAN });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/day-plan");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("reads a day not planned yet: null energy, no reasons, empty lists", async () => {
    const body = {
      date: "2026-10-11",
      allocationTime: "07:00",
      planned: false,
      rejected: false,
      allocator: "",
      energy: null,
      mine: [],
      others: [],
      pool: [{ ...TASK }],
    };
    stubFetch(Response.json(body));
    expect(await getDayPlan()).toEqual({ kind: "ok", plan: body });
  });

  it("treats lists the API sends as null as empty", async () => {
    stubFetch(Response.json({ ...PLAN, mine: null, others: null, pool: null }));
    const result = await getDayPlan();
    expect(result.kind === "ok" && [result.plan.mine, result.plan.others, result.plan.pool]).toEqual([[], [], []]);
  });

  it("keeps an energy of 0 (no Baseline) and a rejected plan", async () => {
    stubFetch(Response.json({ ...PLAN, energy: 0, rejected: true, planned: false }));
    const result = await getDayPlan();
    expect(result.kind === "ok" && result.plan.energy).toBe(0);
    expect(result.kind === "ok" && result.plan.rejected).toBe(true);
  });

  it("is an error for a body it cannot read", async () => {
    stubFetch(Response.json({ ...PLAN, mine: [{ id: "t1" }] }));
    expect(await getDayPlan()).toEqual({ kind: "error" });
    stubFetch(Response.json({ ...PLAN, energy: "high" }));
    expect(await getDayPlan()).toEqual({ kind: "error" });
    stubFetch(Response.json("nope"));
    expect(await getDayPlan()).toEqual({ kind: "error" });
  });

  it("is an error for a server failure", async () => {
    stubFetch(new Response("", { status: 500 }));
    expect(await getDayPlan()).toEqual({ kind: "error" });
  });

  it("is none when the User has no Home (404)", async () => {
    stubFetch(new Response("", { status: 404 }));
    expect(await getDayPlan()).toEqual({ kind: "none" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    stubFetch(Response.json(PLAN));
    expect(await getDayPlan()).toEqual({ kind: "not-signed-in" });
  });

  it("is offline when the request cannot be made", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getDayPlan()).toEqual({ kind: "offline" });
  });
});
