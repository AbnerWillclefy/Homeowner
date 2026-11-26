import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../auth/logic/session";
import { clearResponsible, createChore, deleteChore, listChores, setResponsible, updateChore, type ChoreInput } from "./api";

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

const CHORE = {
  id: "c1",
  name: "Wash dishes",
  category: "kitchen",
  demands: ["bending"],
  baseEffort: 2,
  importance: "normal",
  people: 1,
  intervalDays: 1,
  allowedWeekdays: [1, 3],
  buildsUp: true,
  responsibleResidentId: null,
};

const INPUT: ChoreInput = {
  name: "Wash dishes",
  category: "kitchen",
  demands: ["bending"],
  baseEffort: 2,
  importance: "normal",
  people: 1,
  intervalDays: 1,
  allowedWeekdays: [1, 3],
  buildsUp: true,
};

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("listChores", () => {
  it("returns the Home's Chores from GET /home/chores", async () => {
    const fetch = stubFetch(Response.json({ chores: [CHORE] }));
    expect(await listChores()).toEqual({ kind: "ok", chores: [CHORE] });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/chores");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("keeps a one-off Chore's null interval", async () => {
    stubFetch(Response.json({ chores: [{ ...CHORE, intervalDays: null }] }));
    const result = await listChores();
    expect(result.kind === "ok" && result.chores[0]!.intervalDays).toBeNull();
  });

  it("is an error for a body it cannot read", async () => {
    stubFetch(Response.json({ chores: [{ id: "c1" }] }));
    expect(await listChores()).toEqual({ kind: "error" });
    stubFetch(Response.json({}));
    expect(await listChores()).toEqual({ kind: "error" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    stubFetch(Response.json({ chores: [] }));
    expect(await listChores()).toEqual({ kind: "not-signed-in" });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await listChores()).toEqual({ kind: "offline" });
  });

  it("is an error for a server failure", async () => {
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await listChores()).toEqual({ kind: "error" });
  });
});

describe("responsibleResidentId", () => {
  it("is read from a Chore", async () => {
    stubFetch(Response.json({ chores: [{ ...CHORE, responsibleResidentId: "r1" }] }));
    const result = await listChores();
    expect(result.kind === "ok" && result.chores[0]!.responsibleResidentId).toBe("r1");
  });

  it("reads as Nobody when the API does not send it", async () => {
    const { responsibleResidentId: _unused, ...older } = CHORE;
    stubFetch(Response.json({ chores: [older] }));
    const result = await listChores();
    expect(result.kind === "ok" && result.chores[0]!.responsibleResidentId).toBeNull();
  });

  it("rejects a Chore whose value is the wrong type", async () => {
    stubFetch(Response.json({ chores: [{ ...CHORE, responsibleResidentId: 7 }] }));
    expect(await listChores()).toEqual({ kind: "error" });
  });
});

describe("createChore", () => {
  it("posts the Chore and returns the stored one on 201", async () => {
    const fetch = stubFetch(Response.json(CHORE, { status: 201 }));
    expect(await createChore(INPUT)).toEqual({ kind: "ok", chore: CHORE });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/home/chores");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual(INPUT);
  });

  it("is invalid with the field codes on a 400", async () => {
    stubFetch(
      Response.json({ error: "invalid chore", fields: { name: "required", baseEffort: "out_of_range" } }, { status: 400 }),
    );
    expect(await createChore(INPUT)).toEqual({
      kind: "invalid",
      fields: { name: "required", baseEffort: "out_of_range" },
    });
  });

  it("is an error for a 400 with no field codes", async () => {
    stubFetch(Response.json({ error: "bad request" }, { status: 400 }));
    expect(await createChore(INPUT)).toEqual({ kind: "error" });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await createChore(INPUT)).toEqual({ kind: "offline" });
  });
});

describe("updateChore", () => {
  it("puts the Chore to its own path on 200", async () => {
    const fetch = stubFetch(Response.json(CHORE));
    expect(await updateChore("c 1", INPUT)).toEqual({ kind: "ok", chore: CHORE });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/home/chores/c%201");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual(INPUT);
  });

  it("is none on a 404, a Chore someone else already deleted", async () => {
    stubFetch(Response.json({ error: "chore not found" }, { status: 404 }));
    expect(await updateChore("c1", INPUT)).toEqual({ kind: "none" });
  });

  it("is invalid with the field codes on a 400", async () => {
    stubFetch(Response.json({ fields: { people: "out_of_range" } }, { status: 400 }));
    expect(await updateChore("c1", INPUT)).toEqual({ kind: "invalid", fields: { people: "out_of_range" } });
  });
});

describe("updateChore refusing a Resident", () => {
  it("reads responsible_restricted, with a missing list as empty", async () => {
    stubFetch(
      Response.json(
        { error: "responsible_restricted", residentId: "r1", restrictedBy: ["lifting"], restrictedByChore: false },
        { status: 422 },
      ),
    );
    expect(await updateChore("c1", INPUT)).toEqual({
      kind: "restricted",
      residentId: "r1",
      restrictedBy: ["lifting"],
      restrictedByChore: false,
    });
    stubFetch(Response.json({ error: "responsible_restricted", residentId: "r1" }, { status: 422 }));
    expect(await updateChore("c1", INPUT)).toEqual({
      kind: "restricted",
      residentId: "r1",
      restrictedBy: [],
      restrictedByChore: false,
    });
  });

  it("is an error for a 422 it cannot read", async () => {
    stubFetch(Response.json({ error: "responsible_restricted" }, { status: 422 }));
    expect(await updateChore("c1", INPUT)).toEqual({ kind: "error" });
  });
});

describe("setResponsible", () => {
  it("puts the Resident to the Chore's responsible path and is ok on 204", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await setResponsible("c 1", "r1")).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/home/chores/c%201/responsible");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ residentId: "r1" });
  });

  it("is none on a 404", async () => {
    stubFetch(Response.json({ error: "chore not found" }, { status: 404 }));
    expect(await setResponsible("c1", "r1")).toEqual({ kind: "none" });
  });

  it("is unknown-resident on 422 unknown_resident", async () => {
    stubFetch(Response.json({ error: "unknown_resident" }, { status: 422 }));
    expect(await setResponsible("c1", "r1")).toEqual({ kind: "unknown-resident" });
  });

  it("is restricted on 422 responsible_restricted, with the Demands and the Chore flag", async () => {
    stubFetch(
      Response.json(
        { error: "responsible_restricted", residentId: "r1", restrictedBy: ["lifting", "bending"], restrictedByChore: true },
        { status: 422 },
      ),
    );
    expect(await setResponsible("c1", "r1")).toEqual({
      kind: "restricted",
      residentId: "r1",
      restrictedBy: ["lifting", "bending"],
      restrictedByChore: true,
    });
  });

  it("reads a restricted body with no lists as empty ones", async () => {
    stubFetch(Response.json({ error: "responsible_restricted", residentId: "r1" }, { status: 422 }));
    expect(await setResponsible("c1", "r1")).toEqual({
      kind: "restricted",
      residentId: "r1",
      restrictedBy: [],
      restrictedByChore: false,
    });
  });

  it("is an error for a malformed or unknown 422 body and for a server failure", async () => {
    stubFetch(Response.json({ error: "responsible_restricted", residentId: 5 }, { status: 422 }));
    expect(await setResponsible("c1", "r1")).toEqual({ kind: "error" });
    stubFetch(Response.json("nope", { status: 422 }));
    expect(await setResponsible("c1", "r1")).toEqual({ kind: "error" });
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await setResponsible("c1", "r1")).toEqual({ kind: "error" });
  });

  it("is offline when unreachable and not signed in without a session", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await setResponsible("c1", "r1")).toEqual({ kind: "offline" });
    stubStorage(false);
    stubFetch(new Response(null, { status: 204 }));
    expect(await setResponsible("c1", "r1")).toEqual({ kind: "not-signed-in" });
  });
});

describe("clearResponsible", () => {
  it("sends DELETE to the responsible path and is ok on 204", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await clearResponsible("c1")).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/home/chores/c1/responsible");
    expect(init?.method).toBe("DELETE");
    expect(init?.body).toBeUndefined();
  });

  it("is none on a 404, an error for anything else, and offline when unreachable", async () => {
    stubFetch(Response.json({ error: "chore not found" }, { status: 404 }));
    expect(await clearResponsible("c1")).toEqual({ kind: "none" });
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await clearResponsible("c1")).toEqual({ kind: "error" });
    stubFetch(new Response("{}", { status: 200 }));
    expect(await clearResponsible("c1")).toEqual({ kind: "error" });
    stubFetch(new TypeError("Failed to fetch"));
    expect(await clearResponsible("c1")).toEqual({ kind: "offline" });
  });
});

describe("deleteChore", () => {
  it("sends DELETE and is ok on 204", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await deleteChore("c1")).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/home/chores/c1");
    expect(init?.method).toBe("DELETE");
  });

  it("asks fetch to keep the request alive only when told to", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    await deleteChore("c1", { keepalive: true });
    await deleteChore("c1");
    expect(fetch.mock.calls[0]![1]?.keepalive).toBe(true);
    expect(fetch.mock.calls[1]![1]?.keepalive).toBeUndefined();
  });

  it("is none on a 404, which leaves the Chore gone either way", async () => {
    stubFetch(Response.json({ error: "chore not found" }, { status: 404 }));
    expect(await deleteChore("c1")).toEqual({ kind: "none" });
  });

  it("is an error for a server failure and offline when unreachable", async () => {
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await deleteChore("c1")).toEqual({ kind: "error" });
    stubFetch(new TypeError("Failed to fetch"));
    expect(await deleteChore("c1")).toEqual({ kind: "offline" });
  });
});
