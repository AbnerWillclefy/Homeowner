import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../auth/session";
import { getOwnChoreSettings, putChorePreference, setChoreRestriction } from "./choreSettings";

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  const data = new Map([[SESSION_KEY, JSON.stringify({ idToken: "id-1", refreshToken: "rt-1", expiresAt: Date.now() + 3600_000 })]]);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

const effective = (preference: string, restrictedByChore: boolean) => ({
  preference,
  source: "general",
  restricted: restrictedByChore,
  restrictedBy: [],
  restrictedByChore,
});

describe("getOwnChoreSettings", () => {
  it("returns only the caller's own entries, keyed by Chore id", async () => {
    stubFetch(
      Response.json({
        residents: [
          { id: "r1", you: false, chores: { c1: effective("dislike", true) } },
          { id: "r2", you: true, chores: { c1: effective("like", false), c2: effective("neutral", true) } },
        ],
      }),
    );
    expect(await getOwnChoreSettings()).toEqual({
      kind: "ok",
      settings: {
        c1: { preference: "like", restricted: false },
        c2: { preference: "neutral", restricted: true },
      },
    });
  });

  it("is an error for a body it does not understand and offline when unreachable", async () => {
    stubFetch(Response.json({ residents: "x" }));
    expect(await getOwnChoreSettings()).toEqual({ kind: "error" });
    stubFetch(new TypeError("network"));
    expect(await getOwnChoreSettings()).toEqual({ kind: "offline" });
  });
});

describe("writes", () => {
  it("puts a Preference for one Chore", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await putChorePreference("c 1", "dislike")).toEqual({ kind: "ok" });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home/chores/c%201/preference");
    expect(fetch.mock.calls[0]![1]?.method).toBe("PUT");
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({ preference: "dislike" });
  });

  it("adds and removes a Restriction on one Chore", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    await setChoreRestriction("c1", true);
    await setChoreRestriction("c1", false);
    expect(fetch.mock.calls.map((c) => [c[0], c[1]?.method])).toEqual([
      ["http://api.test/home/chores/c1/restriction", "PUT"],
      ["http://api.test/home/chores/c1/restriction", "DELETE"],
    ]);
  });

  it("reports a refusal as an error", async () => {
    stubFetch(Response.json({ error: "chore not found" }, { status: 404 }));
    expect(await putChorePreference("c1", "like")).toEqual({ kind: "error" });
  });
});
