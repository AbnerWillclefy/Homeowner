import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../auth/logic/session";
import { interpret, parseInterpretation } from "./api";

const BODY = {
  name: "Water the plants",
  category: "garden",
  demands: [],
  baseEffort: 2,
  importance: "normal",
  people: 1,
  intervalDays: 7,
  allowedWeekdays: [],
  buildsUp: false,
};
const create = { kind: "create_chore", choreName: "Water the plants", request: { method: "POST", path: "/home/chores", body: BODY } };
const edit = { kind: "edit_chore", choreId: "c1", choreName: "Mop", changed: ["name"], request: { method: "PUT", path: "/home/chores/c1", body: BODY } };
const task = { kind: "complete", taskId: "t1", choreId: "c1", choreName: "Mop", request: { method: "POST", path: "/home/tasks/t1/complete" } };
const answer = (actions: unknown[], status = "ok") => ({ status, actions, remaining: 9 });

describe("parseInterpretation", () => {
  it("reads create, edit and task actions", () => {
    const parsed = parseInterpretation(answer([create, edit, task]));
    expect(parsed?.actions.map((a) => a.kind)).toEqual(["create_chore", "edit_chore", "complete"]);
    expect(parsed?.actions[2]).toEqual({ kind: "complete", taskId: "t1", choreName: "Mop" });
  });

  it("turns candidates into a choice", () => {
    const choice = { kind: "edit_chore", candidates: [edit, { ...edit, choreId: "c2" }] };
    const [parsed] = parseInterpretation(answer([choice]))?.actions ?? [];
    expect(parsed?.kind).toBe("choice");
    expect(parsed?.kind === "choice" && parsed.candidates.map((c) => c.kind === "edit_chore" && c.choreId)).toEqual(["c1", "c2"]);
  });

  it.each([
    ["an unknown kind", answer([{ ...task, kind: "delete_chore" }])],
    ["an unknown status", answer([], "maybe")],
    ["an unknown changed field", answer([{ ...edit, changed: ["secret"] }])],
    ["a Chore body of the wrong shape", answer([{ ...create, request: { body: { name: 1 } } }])],
    ["a task without an id", answer([{ ...task, taskId: undefined }])],
    ["candidates nested in candidates", answer([{ kind: "x", candidates: [{ kind: "x", candidates: [task] }] }])],
  ])("rejects %s", (_name, body) => {
    expect(parseInterpretation(body)).toBeNull();
  });
});

describe("interpret", () => {
  beforeEach(() => {
    const data = new Map([[SESSION_KEY, JSON.stringify({ idToken: "id-1", refreshToken: "rt-1", expiresAt: Date.now() + 3600_000 })]]);
    vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: () => {}, removeItem: () => {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  const reply = (response: Response | Error) => {
    const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
      if (response instanceof Error) throw response;
      return response;
    });
    vi.stubGlobal("fetch", fn);
    return fn;
  };

  it("posts the transcript and locale as JSON", async () => {
    const fetch = reply(Response.json(answer([create])));
    const result = await interpret("regar", "pt-BR");
    expect(result.kind).toBe("ok");
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/voice/interpret");
    expect(fetch.mock.calls[0]![1]?.method).toBe("POST");
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({ transcript: "regar", locale: "pt-BR" });
  });

  it.each([
    [400, "invalid"],
    [429, "limit"],
    [503, "unavailable"],
    [502, "failed"],
    [504, "failed"],
    [500, "error"],
  ])("maps %s to %s", async (status, kind) => {
    reply(Response.json({ error: "x" }, { status }));
    expect(await interpret("x", "en-US")).toEqual({ kind });
  });

  it("is an error for an unknown kind, and offline when the call throws", async () => {
    reply(Response.json(answer([{ ...task, kind: "delete_chore" }])));
    expect(await interpret("x", "en-US")).toEqual({ kind: "error" });
    reply(new TypeError("net"));
    expect(await interpret("x", "en-US")).toEqual({ kind: "offline" });
  });
});
