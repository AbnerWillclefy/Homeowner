import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../auth/session";
import { getOnboarding, putOnboardingStep } from "./onboarding";

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

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("getOnboarding", () => {
  it("returns the step to show from GET /me/onboarding", async () => {
    const fetch = stubFetch(Response.json({ step: "baseline" }));
    expect(await getOnboarding()).toEqual({ kind: "ok", step: "baseline" });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/me/onboarding");
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get("Authorization")).toBe("Bearer id-1");
  });

  it("accepts done", async () => {
    stubFetch(Response.json({ step: "done" }));
    expect(await getOnboarding()).toEqual({ kind: "ok", step: "done" });
  });

  it("is an error for a step this app does not know", async () => {
    stubFetch(Response.json({ step: "teleport" }));
    expect(await getOnboarding()).toEqual({ kind: "error" });
    stubFetch(Response.json({}));
    expect(await getOnboarding()).toEqual({ kind: "error" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    stubFetch(Response.json({ step: "install" }));
    expect(await getOnboarding()).toEqual({ kind: "not-signed-in" });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getOnboarding()).toEqual({ kind: "offline" });
  });

  it("is an error for a server failure", async () => {
    stubFetch(Response.json({ error: "internal error" }, { status: 500 }));
    expect(await getOnboarding()).toEqual({ kind: "error" });
  });
});

describe("putOnboardingStep", () => {
  it("PUTs the completed step and returns the next step to show", async () => {
    const fetch = stubFetch(Response.json({ step: "reminders" }));
    expect(await putOnboardingStep("install")).toEqual({ kind: "ok", step: "reminders" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/me/onboarding");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(JSON.stringify({ step: "install" }));
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("is an error for a 400", async () => {
    stubFetch(Response.json({ error: "invalid_step" }, { status: 400 }));
    expect(await putOnboardingStep("install")).toEqual({ kind: "error" });
  });

  it("is offline when the API cannot be reached", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await putOnboardingStep("install")).toEqual({ kind: "offline" });
  });

  it("is not signed in without a session", async () => {
    stubStorage(false);
    stubFetch(Response.json({ step: "reminders" }));
    expect(await putOnboardingStep("install")).toEqual({ kind: "not-signed-in" });
  });
});
