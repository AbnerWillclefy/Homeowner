import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../auth/logic/session";
import {
  getCategories,
  getDemands,
  getProfile,
  putBaseline,
  putPreference,
  setName,
  setRestriction,
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

const noContent = () => new Response(null, { status: 204 });

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("getCategories and getDemands", () => {
  it("return the ids in the order the API sends them", async () => {
    const fetch = stubFetch(Response.json({ categories: ["kitchen", "pets"] }));
    expect(await getCategories()).toEqual({ kind: "ok", ids: ["kitchen", "pets"] });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/categories");

    const demandsFetch = stubFetch(Response.json({ demands: ["bending"] }));
    expect(await getDemands()).toEqual({ kind: "ok", ids: ["bending"] });
    expect(demandsFetch.mock.calls[0]![0]).toBe("http://api.test/demands");
  });

  it("are an error for a body that is not a list of strings", async () => {
    stubFetch(Response.json({ categories: [1] }));
    expect(await getCategories()).toEqual({ kind: "error" });
    stubFetch(Response.json({}));
    expect(await getDemands()).toEqual({ kind: "error" });
  });

  it("report not-signed-in and offline", async () => {
    stubStorage(false);
    stubFetch(Response.json({}));
    expect(await getCategories()).toEqual({ kind: "not-signed-in" });
    stubStorage(true);
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getDemands()).toEqual({ kind: "offline" });
  });
});

describe("getProfile", () => {
  it("reads Baseline by weekday name, with null for an unset day", async () => {
    const baseline = {
      sunday: null,
      monday: 5,
      tuesday: 0,
      wednesday: null,
      thursday: null,
      friday: 3,
      saturday: null,
    };
    const fetch = stubFetch(
      Response.json({ baseline, preferences: { kitchen: "dislike" }, restrictions: ["bending"] }),
    );
    expect(await getProfile()).toEqual({
      kind: "ok",
      profile: { baseline, preferences: { kitchen: "dislike" }, restrictions: ["bending"] },
    });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/me/profile");
  });

  it("treats a missing weekday as unset", async () => {
    stubFetch(Response.json({ baseline: { monday: 4 }, preferences: {}, restrictions: [] }));
    const result = await getProfile();
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.profile.baseline.monday).toBe(4);
    expect(result.profile.baseline.sunday).toBeNull();
  });

  it("is an error for a malformed body or a server failure", async () => {
    stubFetch(Response.json({ baseline: { monday: "x" }, preferences: {}, restrictions: [] }));
    expect(await getProfile()).toEqual({ kind: "error" });
    stubFetch(Response.json({ baseline: {}, preferences: { kitchen: "love" }, restrictions: [] }));
    expect(await getProfile()).toEqual({ kind: "error" });
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await getProfile()).toEqual({ kind: "error" });
  });

  it("reports not-signed-in and offline", async () => {
    stubStorage(false);
    expect(await getProfile()).toEqual({ kind: "not-signed-in" });
    stubStorage(true);
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getProfile()).toEqual({ kind: "offline" });
  });
});

describe("the writes", () => {
  it("putBaseline sends only the named days, null clearing one, 0 staying a value", async () => {
    const fetch = stubFetch(noContent());
    expect(await putBaseline({ monday: 0, tuesday: null })).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/me/baseline");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe('{"monday":0,"tuesday":null}');
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("putPreference sends the preference to the Category path, encoding the id", async () => {
    const fetch = stubFetch(noContent());
    expect(await putPreference("living_room", "like")).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/me/preferences/living_room");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe('{"preference":"like"}');
  });

  it("setRestriction PUTs to add and DELETEs to remove", async () => {
    const fetch = stubFetch(noContent());
    expect(await setRestriction("heights", true)).toEqual({ kind: "ok" });
    expect(fetch.mock.calls[0]![1]?.method).toBe("PUT");
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/me/restrictions/heights");
    expect(await setRestriction("heights", false)).toEqual({ kind: "ok" });
    expect(fetch.mock.calls[1]![1]?.method).toBe("DELETE");
  });

  it("are an error for any status but 204", async () => {
    stubFetch(Response.json({ error: "unknown demand" }, { status: 404 }));
    expect(await setRestriction("nope", true)).toEqual({ kind: "error" });
    stubFetch(Response.json({ error: "bad" }, { status: 400 }));
    expect(await putBaseline({ monday: 99 })).toEqual({ kind: "error" });
  });

  it("report not-signed-in and offline", async () => {
    stubStorage(false);
    expect(await putPreference("kitchen", "like")).toEqual({ kind: "not-signed-in" });
    stubStorage(true);
    stubFetch(new TypeError("Failed to fetch"));
    expect(await putPreference("kitchen", "like")).toEqual({ kind: "offline" });
    expect(await setRestriction("bending", false)).toEqual({ kind: "offline" });
    expect(await putBaseline({ monday: 1 })).toEqual({ kind: "offline" });
  });
});

describe("setName", () => {
  const saved = { id: "u1", email: "a@example.com", displayName: "Abner", name: "Abner", photoUrl: null, initials: "A", avatarTone: "kitchen" };

  it("PUTs the name and returns the updated User", async () => {
    const fetch = stubFetch(Response.json(saved));
    expect(await setName("Abner")).toEqual({ kind: "ok", me: saved });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/me/name");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ name: "Abner" });
  });

  it("sends null to clear the name", async () => {
    const cleared = { ...saved, displayName: null, name: "a" };
    const fetch = stubFetch(Response.json(cleared));
    expect(await setName(null)).toEqual({ kind: "ok", me: cleared });
    expect(JSON.parse(fetch.mock.calls[0]![1]?.body as string)).toEqual({ name: null });
  });

  it("is an error when a 200 does not describe a User", async () => {
    stubFetch(Response.json({ nope: true }));
    expect(await setName("Abner")).toEqual({ kind: "error" });
  });

  it("names a 400 too_long and a 400 invalid", async () => {
    stubFetch(Response.json({ error: "too_long" }, { status: 400 }));
    expect(await setName("x")).toEqual({ kind: "too_long" });
    stubFetch(Response.json({ error: "invalid" }, { status: 400 }));
    expect(await setName("x")).toEqual({ kind: "invalid" });
  });

  it("is an error for a 400 with another code, and for a 500", async () => {
    stubFetch(Response.json({ error: "bad request" }, { status: 400 }));
    expect(await setName("x")).toEqual({ kind: "error" });
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await setName("x")).toEqual({ kind: "error" });
  });

  it("is offline when the request cannot be sent", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await setName("x")).toEqual({ kind: "offline" });
  });

  it("is not-signed-in without a session", async () => {
    stubStorage(false);
    expect(await setName("x")).toEqual({ kind: "not-signed-in" });
  });
});
