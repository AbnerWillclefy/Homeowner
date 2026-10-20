import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../auth/logic/session";
import {
  acceptAll,
  acceptSwap,
  acceptTask,
  cancelSwap,
  completeTask,
  declineSwap,
  getDayPlan,
  offerSwap,
  planMyDay,
  refuseTask,
  replanHome,
  takeTask,
} from "./api";

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
  doneToday: [],
  swaps: { incoming: [], outgoing: [] },
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
      doneToday: [],
      swaps: { incoming: [], outgoing: [] },
    };
    stubFetch(Response.json(body));
    expect(await getDayPlan()).toEqual({ kind: "ok", plan: body });
  });

  const EXPLANATION = {
    source: "llm",
    headline: { "en-US": "A light day", "pt-BR": "Um dia leve" },
    detail: { "en-US": "Rest is the plan.", "pt-BR": "Descansar é o plano." },
  };

  it("keeps the explanation the API sends, with headline and detail in both languages", async () => {
    stubFetch(Response.json({ ...PLAN, explanation: { ...EXPLANATION, text: { "en-US": "old", "pt-BR": "velho" } } }));
    const result = await getDayPlan();
    expect(result.kind === "ok" && result.plan.explanation).toEqual(EXPLANATION);
  });

  it.each([
    ["null", null],
    ["a string", "A light day."],
    ["only the old text field", { source: "llm", text: { "en-US": "a", "pt-BR": "b" } }],
    ["an unknown source", { ...EXPLANATION, source: "robot" }],
    ["a missing headline", { source: "template", detail: EXPLANATION.detail }],
    ["a missing detail", { source: "template", headline: EXPLANATION.headline }],
    ["a missing headline language", { ...EXPLANATION, headline: { "en-US": "a" } }],
    ["a missing detail language", { ...EXPLANATION, detail: { "pt-BR": "a" } }],
    ["a blank headline", { ...EXPLANATION, headline: { "en-US": "a", "pt-BR": "  " } }],
    ["a blank detail", { ...EXPLANATION, detail: { "en-US": "", "pt-BR": "b" } }],
    ["a headline that is not a string", { ...EXPLANATION, headline: { "en-US": "a", "pt-BR": 3 } }],
  ])("reads %s as no explanation and still reads the plan", async (_name, explanation) => {
    stubFetch(Response.json({ ...PLAN, explanation }));
    const result = await getDayPlan();
    expect(result.kind).toBe("ok");
    expect(result.kind === "ok" && "explanation" in result.plan).toBe(false);
  });

  it("treats lists the API sends as null as empty", async () => {
    stubFetch(Response.json({ ...PLAN, mine: null, others: null, pool: null }));
    const result = await getDayPlan();
    expect(result.kind === "ok" && [result.plan.mine, result.plan.others, result.plan.pool]).toEqual([[], [], []]);
  });

  it("keeps a Task's Category when the API sends one", async () => {
    stubFetch(Response.json({ ...PLAN, mine: [{ ...TASK, category: "kitchen" }] }));
    const result = await getDayPlan();
    expect(result.kind === "ok" && result.plan.mine[0]?.category).toBe("kitchen");
  });

  it("keeps a Category id the app does not know, for the card to render neutral", async () => {
    stubFetch(Response.json({ ...PLAN, pool: [{ ...TASK, category: "garage" }] }));
    const result = await getDayPlan();
    expect(result.kind === "ok" && result.plan.pool[0]?.category).toBe("garage");
  });

  it("reads a Task without a Category (an older API during a deploy) instead of failing the plan", async () => {
    stubFetch(Response.json(PLAN));
    const result = await getDayPlan();
    expect(result.kind).toBe("ok");
    expect(result.kind === "ok" && "category" in result.plan.mine[0]!).toBe(false);
  });

  it.each([42, null, true, ["kitchen"]])("drops a non-string Category (%j) and still reads the plan", async (category) => {
    stubFetch(
      Response.json({ ...PLAN, mine: [{ ...TASK, category }], others: [{ residentId: "r2", tasks: [{ ...TASK, category }] }] }),
    );
    const result = await getDayPlan();
    expect(result.kind).toBe("ok");
    expect(result.kind === "ok" && "category" in result.plan.mine[0]!).toBe(false);
    expect(result.kind === "ok" && result.plan.mine[0]?.choreName).toBe("Wash dishes");
    expect(result.kind === "ok" && "category" in result.plan.others[0]!.tasks[0]!).toBe(false);
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

const DONE = {
  id: "t9",
  choreName: "Take out trash",
  completedAt: "2026-10-11T14:30:00Z",
  with: [] as string[],
};

describe("committed and doneToday", () => {
  it("reads committed on Tasks and doneToday entries", async () => {
    const plan = {
      ...PLAN,
      mine: [{ ...TASK, committed: true }],
      pool: [{ ...TASK, id: "t3", committed: false }],
      doneToday: [DONE],
    };
    stubFetch(Response.json(plan));
    expect(await getDayPlan()).toEqual({ kind: "ok", plan });
  });

  it("leaves committed out when the API does not send it", async () => {
    stubFetch(Response.json(PLAN));
    const result = await getDayPlan();
    expect(result.kind === "ok" && "committed" in result.plan.mine[0]!).toBe(false);
  });

  it("reads a null or missing doneToday as empty", async () => {
    stubFetch(Response.json({ ...PLAN, doneToday: null }));
    const a = await getDayPlan();
    expect(a.kind === "ok" && a.plan.doneToday).toEqual([]);
    const { doneToday: _unused, ...without } = PLAN;
    stubFetch(Response.json(without));
    const b = await getDayPlan();
    expect(b.kind === "ok" && b.plan.doneToday).toEqual([]);
  });

  it("is an error for a non-boolean committed or a malformed doneToday entry", async () => {
    stubFetch(Response.json({ ...PLAN, mine: [{ ...TASK, committed: "yes" }] }));
    expect(await getDayPlan()).toEqual({ kind: "error" });
    stubFetch(Response.json({ ...PLAN, others: [{ residentId: "r2", tasks: [{ ...TASK, committed: 1 }] }] }));
    expect(await getDayPlan()).toEqual({ kind: "error" });
    stubFetch(Response.json({ ...PLAN, doneToday: [DONE, { id: "t8" }] }));
    expect(await getDayPlan()).toEqual({ kind: "error" });
    stubFetch(Response.json({ ...PLAN, doneToday: "none" }));
    expect(await getDayPlan()).toEqual({ kind: "error" });
  });
});

describe("doneToday with and category", () => {
  const read = async (entry: unknown) => {
    stubFetch(Response.json({ ...PLAN, doneToday: [entry] }));
    return getDayPlan();
  };
  const { with: _with, ...WITHOUT } = DONE;

  it("keeps a well formed with and category", async () => {
    const entry = { ...DONE, with: ["r2"], category: "kitchen" };
    expect(await read(entry)).toEqual({ kind: "ok", plan: { ...PLAN, doneToday: [entry] } });
  });

  it("reads a missing with (an older API) as empty", async () => {
    expect(await read(WITHOUT)).toEqual({ kind: "ok", plan: { ...PLAN, doneToday: [DONE] } });
  });

  it.each([null, "r2", [1], ["r2", 1], {}])("reads with %j as empty, not as an error", async (bad) => {
    expect(await read({ ...DONE, with: bad })).toEqual({ kind: "ok", plan: { ...PLAN, doneToday: [DONE] } });
  });

  it("leaves a missing or odd category out", async () => {
    for (const category of [undefined, null, 3]) {
      const result = await read({ ...DONE, category });
      expect(result.kind === "ok" && "category" in result.plan.doneToday[0]!).toBe(false);
    }
  });
});

describe("two-person fields", () => {
  it("reads suggestTwoPerson and with on a Task", async () => {
    const plan = { ...PLAN, mine: [{ ...TASK, people: 2, suggestTwoPerson: true, with: ["r2"] }] };
    stubFetch(Response.json(plan));
    expect(await getDayPlan()).toEqual({ kind: "ok", plan });
  });

  it("leaves them out when the API does not send them, which reads as false and no partner", async () => {
    stubFetch(Response.json(PLAN));
    const result = await getDayPlan();
    const task = result.kind === "ok" ? result.plan.mine[0]! : undefined;
    expect(task).toBeDefined();
    expect(task && "suggestTwoPerson" in task).toBe(false);
    expect(task && "with" in task).toBe(false);
  });

  it("is lenient with odd values and never errors the plan", async () => {
    stubFetch(Response.json({ ...PLAN, mine: [{ ...TASK, suggestTwoPerson: "yes", with: [1, "r2", null] }] }));
    const result = await getDayPlan();
    const task = result.kind === "ok" ? result.plan.mine[0]! : undefined;
    expect(task && "suggestTwoPerson" in task).toBe(false);
    expect(task?.with).toEqual(["r2"]);
    stubFetch(Response.json({ ...PLAN, mine: [{ ...TASK, with: "r2" }] }));
    expect((await getDayPlan()).kind).toBe("ok");
  });
});

describe.each([
  ["acceptTask", () => acceptTask("t 1/x"), "/home/tasks/t%201%2Fx/accept"],
  ["refuseTask", () => refuseTask("t 1/x"), "/home/tasks/t%201%2Fx/refuse"],
  ["takeTask", () => takeTask("t 1/x"), "/home/tasks/t%201%2Fx/take"],
  ["completeTask", () => completeTask("t 1/x"), "/home/tasks/t%201%2Fx/complete"],
  ["acceptAll", () => acceptAll(), "/home/day-plan/accept-all"],
  ["acceptSwap", () => acceptSwap("s 1/x"), "/home/swaps/s%201%2Fx/accept"],
  ["declineSwap", () => declineSwap("s 1/x"), "/home/swaps/s%201%2Fx/decline"],
  ["cancelSwap", () => cancelSwap("s 1/x"), "/home/swaps/s%201%2Fx/cancel"],
])("%s", (_name, call, path) => {
  it("posts to the route with no body and returns the Day Plan", async () => {
    const fetch = stubFetch(Response.json(PLAN));
    expect(await call()).toEqual({ kind: "ok", plan: PLAN });
    expect(fetch.mock.calls[0]![0]).toBe(`http://api.test${path}`);
    expect(fetch.mock.calls[0]![1]?.method).toBe("POST");
    expect(fetch.mock.calls[0]![1]?.body).toBeUndefined();
  });

  it("is a conflict with the API's code on 409", async () => {
    stubFetch(Response.json({ error: "not_in_pool" }, { status: 409 }));
    expect(await call()).toEqual({ kind: "conflict", code: "not_in_pool" });
  });

  it("is a conflict with code unknown when the 409 body is unreadable", async () => {
    stubFetch(new Response("<html>", { status: 409 }));
    expect(await call()).toEqual({ kind: "conflict", code: "unknown" });
  });

  it("is none on 404, error on 500 or a bad body", async () => {
    stubFetch(new Response("", { status: 404 }));
    expect(await call()).toEqual({ kind: "none" });
    stubFetch(new Response("", { status: 500 }));
    expect(await call()).toEqual({ kind: "error" });
    stubFetch(Response.json({ nope: 1 }));
    expect(await call()).toEqual({ kind: "error" });
  });

  it("is offline when the request fails, and not signed in without a session", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await call()).toEqual({ kind: "offline" });
    stubStorage(false);
    const fetch = stubFetch(Response.json(PLAN));
    expect(await call()).toEqual({ kind: "not-signed-in" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

const EMPTY_SWAPS = { incoming: [], outgoing: [] };
const OFFER = { id: "s1", residentId: "r2", offered: { ...TASK, id: "t1" }, requested: { ...TASK, id: "t2" } };

async function readSwaps(swaps: unknown) {
  stubFetch(Response.json({ ...PLAN, swaps }));
  const result = await getDayPlan();
  if (result.kind !== "ok") throw new Error(`expected ok, got ${result.kind}`);
  return result.plan.swaps;
}

describe("swaps", () => {
  it.each([
    ["absent", undefined],
    ["null", null],
    ["a string", "x"],
    ["an empty object", {}],
    ["null lists", { incoming: null, outgoing: null }],
    ["non-array lists", { incoming: "x", outgoing: 3 }],
    ["empty lists", EMPTY_SWAPS],
  ])("reads %s as no offers", async (_name, swaps) => {
    expect(await readSwaps(swaps)).toEqual(EMPTY_SWAPS);
  });

  it("reads a valid incoming and a valid outgoing offer", async () => {
    const out = { ...OFFER, id: "s2", residentId: "r3" };
    expect(await readSwaps({ incoming: [OFFER], outgoing: [out] })).toEqual({ incoming: [OFFER], outgoing: [out] });
  });

  it("drops a malformed offer, keeps its siblings and the plan stays ok", async () => {
    const badTask = { ...OFFER, id: "bad", offered: { id: "x" } };
    const noId = { ...OFFER, id: undefined };
    const blankId = { ...OFFER, id: "" };
    const noResident = { ...OFFER, id: "s9", residentId: 4 };
    const noRequested = { ...OFFER, id: "s8", requested: null };
    const emptyTask = { ...OFFER, id: "s7", requested: { ...TASK, id: "" } };
    const swaps = await readSwaps({
      incoming: [badTask, OFFER, noId, blankId, null, "x", 7, noResident, noRequested, emptyTask],
      outgoing: [badTask],
    });
    expect(swaps).toEqual({ incoming: [OFFER], outgoing: [] });
  });
});

describe("offerSwap", () => {
  it("posts the two Task ids as JSON and returns the Day Plan", async () => {
    const fetch = stubFetch(Response.json(PLAN));
    expect(await offerSwap("t1", "t2")).toEqual({ kind: "ok", plan: PLAN });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/swaps");
    const init = fetch.mock.calls[0]![1];
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({ offeredTaskId: "t1", requestedTaskId: "t2" });
  });

  it("is a conflict with the code on 409, and none on 404 task not found", async () => {
    stubFetch(Response.json({ error: "swap_pending" }, { status: 409 }));
    expect(await offerSwap("t1", "t2")).toEqual({ kind: "conflict", code: "swap_pending" });
    stubFetch(Response.json({ error: "task not found" }, { status: 404 }));
    expect(await offerSwap("t1", "t2")).toEqual({ kind: "none" });
  });
});

describe("a 404 on a Swap route", () => {
  it("is a conflict when the code is swap_not_found", async () => {
    stubFetch(Response.json({ error: "swap_not_found" }, { status: 404 }));
    expect(await acceptSwap("s1")).toEqual({ kind: "conflict", code: "swap_not_found" });
  });

  it.each([
    ["another code", () => Response.json({ error: "no home" }, { status: 404 })],
    ["task not found", () => Response.json({ error: "task not found" }, { status: 404 })],
    ["no body", () => new Response("", { status: 404 })],
    ["an unreadable body", () => new Response("<html>", { status: 404 })],
  ])("stays none with %s", async (_name, reply) => {
    stubFetch(reply());
    expect(await declineSwap("s1")).toEqual({ kind: "none" });
    stubFetch(reply());
    expect(await takeTask("t1")).toEqual({ kind: "none" });
  });

  it("is an error, not a conflict, when a read gets swap_not_found", async () => {
    stubFetch(Response.json({ error: "swap_not_found" }, { status: 404 }));
    expect(await getDayPlan()).toEqual({ kind: "error" });
  });
});

describe("planMyDay", () => {
  it("posts to /home/day-plan/me with no body and returns the Day Plan", async () => {
    const fetch = stubFetch(Response.json(PLAN));
    expect(await planMyDay()).toEqual({ kind: "ok", plan: PLAN });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/day-plan/me");
    expect(fetch.mock.calls[0]![1]?.method).toBe("POST");
    expect(fetch.mock.calls[0]![1]?.body).toBeUndefined();
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("keeps an energy of 0 so the app can say why nothing was given", async () => {
    stubFetch(Response.json({ ...PLAN, energy: 0, mine: [] }));
    const result = await planMyDay();
    expect(result.kind === "ok" && result.plan.energy).toBe(0);
  });

  it("is none when the User has no Home (404)", async () => {
    stubFetch(new Response("", { status: 404 }));
    expect(await planMyDay()).toEqual({ kind: "none" });
  });

  it("is an error for a server failure or a body it cannot read", async () => {
    stubFetch(new Response("", { status: 500 }));
    expect(await planMyDay()).toEqual({ kind: "error" });
    stubFetch(Response.json({ ...PLAN, planned: "yes" }));
    expect(await planMyDay()).toEqual({ kind: "error" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    const fetch = stubFetch(Response.json(PLAN));
    expect(await planMyDay()).toEqual({ kind: "not-signed-in" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("is offline when the request cannot be made", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await planMyDay()).toEqual({ kind: "offline" });
  });
});

describe("replanHome", () => {
  it("posts to /dev/replan with no body and reads 202 as ok", async () => {
    const fetch = stubFetch(new Response(null, { status: 202 }));
    expect(await replanHome()).toEqual({ kind: "ok" });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/dev/replan");
    expect(fetch.mock.calls[0]![1]?.method).toBe("POST");
    expect(fetch.mock.calls[0]![1]?.body).toBeUndefined();
  });

  it("reads 404 as none: the route does not exist outside staging", async () => {
    stubFetch(new Response(null, { status: 404 }));
    expect(await replanHome()).toEqual({ kind: "none" });
  });

  it("reads another status as an error", async () => {
    stubFetch(new Response(null, { status: 500 }));
    expect(await replanHome()).toEqual({ kind: "error" });
  });

  it("reads a network failure as offline", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await replanHome()).toEqual({ kind: "offline" });
  });

  it("reads no session as not-signed-in", async () => {
    stubStorage(false);
    stubFetch(new Response(null, { status: 202 }));
    expect(await replanHome()).toEqual({ kind: "not-signed-in" });
  });
});

describe("getDayPlan run identity", () => {
  it("keeps runId and fallbackReason when they are strings", async () => {
    stubFetch(Response.json({ ...PLAN, runId: "run-1", fallbackReason: "llm_error" }));
    expect(await getDayPlan()).toEqual({ kind: "ok", plan: { ...PLAN, runId: "run-1", fallbackReason: "llm_error" } });
  });

  it("leaves them out when absent or odd, never failing the plan", async () => {
    stubFetch(Response.json({ ...PLAN, runId: 7, fallbackReason: null }));
    expect(await getDayPlan()).toEqual({ kind: "ok", plan: PLAN });
  });
});
