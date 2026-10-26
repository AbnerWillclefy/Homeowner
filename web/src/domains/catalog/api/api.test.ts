import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../auth/logic/session";
import { getCatalog, proposeChores } from "./api";

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

const FIELDS = {
  name: "Clean the bathroom",
  category: "bathroom",
  demands: ["bending", "strong_chemicals"],
  baseEffort: 3,
  importance: "essential",
  people: 1,
  intervalDays: 7,
  allowedWeekdays: [],
  buildsUp: true,
};

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://api.test");
  stubStorage(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getCatalog", () => {
  it("reads the entries in the order sent", async () => {
    const fetch = stubFetch(Response.json({ entries: [{ id: "clean_bathroom", perRoom: true, ...FIELDS }] }));
    const result = await getCatalog();
    expect(result).toEqual({ kind: "ok", entries: [{ id: "clean_bathroom", perRoom: true, ...FIELDS }] });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/catalog");
  });

  it("is an error for an entry that is malformed", async () => {
    stubFetch(Response.json({ entries: [{ id: "x" }] }));
    expect(await getCatalog()).toEqual({ kind: "error" });
  });

  it("is not-signed-in, offline or error like the other calls", async () => {
    stubStorage(false);
    expect(await getCatalog()).toEqual({ kind: "not-signed-in" });
    stubStorage(true);
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getCatalog()).toEqual({ kind: "offline" });
    stubFetch(new Response("", { status: 500 }));
    expect(await getCatalog()).toEqual({ kind: "error" });
  });
});

describe("proposeChores", () => {
  it("posts the answers and reads the proposals, keeping a null instance", async () => {
    const fetch = stubFetch(
      Response.json({
        proposals: [
          { catalogId: "clean_bathroom", instance: null, ...FIELDS },
          { catalogId: "clean_bathroom", instance: 2, ...FIELDS },
        ],
      }),
    );
    const result = await proposeChores({ outdoor: { balconies: 0, yards: 1, gardens: 0 } });
    expect(result).toEqual({
      kind: "ok",
      proposals: [
        { catalogId: "clean_bathroom", instance: null, ...FIELDS },
        { catalogId: "clean_bathroom", instance: 2, ...FIELDS },
      ],
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/catalog/proposals");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ outdoor: { balconies: 0, yards: 1, gardens: 0 } });
  });

  it("is invalid with the field codes on a 400", async () => {
    stubFetch(Response.json({ error: "invalid answers", fields: { "rooms.bathrooms": "out_of_range" } }, { status: 400 }));
    expect(await proposeChores({})).toEqual({ kind: "invalid", fields: { "rooms.bathrooms": "out_of_range" } });
  });

  it("is an error for a 400 without fields, and offline when the fetch throws", async () => {
    stubFetch(Response.json({ error: "bad" }, { status: 400 }));
    expect(await proposeChores({})).toEqual({ kind: "error" });
    stubFetch(new TypeError("Failed to fetch"));
    expect(await proposeChores({})).toEqual({ kind: "offline" });
  });
});
