import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../auth/session";
import { createHome, getHome, leaveHome, updateHome } from "./home";

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

const HOME = { id: "h1", timezone: "America/Sao_Paulo", allocationTime: "07:30" };
const SETTINGS = { timezone: "America/Sao_Paulo", allocationTime: "07:30" };

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("getHome", () => {
  it("returns the caller's Home from GET /home", async () => {
    const fetch = stubFetch(Response.json(HOME));
    expect(await getHome()).toEqual({ kind: "ok", home: HOME });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/home");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("is none on a 404, which is how the screen knows to show the create form", async () => {
    stubFetch(Response.json({ error: "no home" }, { status: 404 }));
    expect(await getHome()).toEqual({ kind: "none" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    stubFetch(Response.json(HOME));
    expect(await getHome()).toEqual({ kind: "not-signed-in" });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getHome()).toEqual({ kind: "offline" });
  });

  it("is an error for a server failure or an unexpected body", async () => {
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await getHome()).toEqual({ kind: "error" });
    stubFetch(Response.json({ id: "h1" }));
    expect(await getHome()).toEqual({ kind: "error" });
  });
});

describe("createHome", () => {
  it("posts the settings and returns the new Home on 201", async () => {
    const fetch = stubFetch(Response.json(HOME, { status: 201 }));
    expect(await createHome(SETTINGS)).toEqual({ kind: "ok", home: HOME });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/home");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual(SETTINGS);
  });

  it("sends the reviewed Chores only when there are some", async () => {
    const chore = {
      name: "Wash the dishes",
      category: "kitchen",
      demands: [],
      baseEffort: 1,
      importance: "essential",
      people: 1,
      intervalDays: 1,
      allowedWeekdays: [],
      buildsUp: true,
    };
    const fetch = stubFetch(Response.json(HOME, { status: 201 }));
    await createHome(SETTINGS, [chore]);
    expect(JSON.parse(fetch.mock.calls[0]![1]?.body as string)).toEqual({ ...SETTINGS, chores: [chore] });
    await createHome(SETTINGS, []);
    expect(JSON.parse(fetch.mock.calls[1]![1]?.body as string)).toEqual(SETTINGS);
  });

  it("is already-resident on a 409", async () => {
    stubFetch(Response.json({ error: "already a resident" }, { status: 409 }));
    expect(await createHome(SETTINGS)).toEqual({ kind: "already-resident" });
  });

  it("is invalid with the field codes on a 400", async () => {
    stubFetch(
      Response.json(
        { error: "invalid home", fields: { timezone: "unknown", allocationTime: "not_quarter_hour" } },
        { status: 400 },
      ),
    );
    expect(await createHome(SETTINGS)).toEqual({
      kind: "invalid",
      fields: { timezone: "unknown", allocationTime: "not_quarter_hour" },
    });
  });

  it("is an error for a 400 without usable fields", async () => {
    stubFetch(Response.json({ error: "bad request" }, { status: 400 }));
    expect(await createHome(SETTINGS)).toEqual({ kind: "error" });
  });

  it("is offline, not-signed-in or error like the other calls", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await createHome(SETTINGS)).toEqual({ kind: "offline" });
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await createHome(SETTINGS)).toEqual({ kind: "error" });
    stubStorage(false);
    expect(await createHome(SETTINGS)).toEqual({ kind: "not-signed-in" });
  });
});

describe("updateHome", () => {
  it("puts the settings and returns the Home on 200", async () => {
    const fetch = stubFetch(Response.json(HOME));
    expect(await updateHome(SETTINGS)).toEqual({ kind: "ok", home: HOME });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/home");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual(SETTINGS);
  });

  it("is none on a 404 and invalid on a 400", async () => {
    stubFetch(Response.json({ error: "no home" }, { status: 404 }));
    expect(await updateHome(SETTINGS)).toEqual({ kind: "none" });
    stubFetch(Response.json({ error: "invalid home", fields: { allocationTime: "invalid" } }, { status: 400 }));
    expect(await updateHome(SETTINGS)).toEqual({ kind: "invalid", fields: { allocationTime: "invalid" } });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await updateHome(SETTINGS)).toEqual({ kind: "offline" });
  });
});

describe("leaveHome", () => {
  it("sends DELETE /home/residents/me with the session and is ok on 204", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await leaveHome()).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/home/residents/me");
    expect(init?.method).toBe("DELETE");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("is none on a 404: there is no Home to leave, which is the outcome asked for", async () => {
    stubFetch(Response.json({ error: "no home" }, { status: 404 }));
    expect(await leaveHome()).toEqual({ kind: "none" });
  });

  it("is an error for any other status", async () => {
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await leaveHome()).toEqual({ kind: "error" });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await leaveHome()).toEqual({ kind: "offline" });
  });

  it("is not signed in without a session, and sends nothing", async () => {
    stubStorage(false);
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await leaveHome()).toEqual({ kind: "not-signed-in" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
