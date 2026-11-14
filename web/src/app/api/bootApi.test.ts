import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../domains/auth/logic/session";
import { getBoot } from "./bootApi";

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

describe("getBoot", () => {
  it("reads GET /boot for the month and keeps each section's status and body", async () => {
    const sections = { "/home": { status: 200, body: { id: "h1" } }, "/home/day-plan": { status: 404, body: { error: "no home" } } };
    const fetch = stubFetch(Response.json({ sections }));
    expect(await getBoot("2030-01")).toEqual(sections);
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/boot?month=2030-01");
  });

  it.each([
    ["no sections", {}],
    ["sections that is a list", { sections: [] }],
    ["a section with no status", { sections: { "/home": { body: {} } } }],
    ["a section that is not an object", { sections: { "/home": null } }],
  ])("is null for a body with %s", async (_name, body) => {
    stubFetch(Response.json(body));
    expect(await getBoot("2030-01")).toBeNull();
  });

  it("is null for a status other than 200 and for a network failure", async () => {
    stubFetch(Response.json({ sections: {} }, { status: 500 }));
    expect(await getBoot("2030-01")).toBeNull();
    stubFetch(new Error("offline"));
    expect(await getBoot("2030-01")).toBeNull();
  });
});
