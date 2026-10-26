import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../auth/cognito";
import { createSessionStore, type Session } from "../auth/session";
import { createApiClient, NotSignedIn, RefreshUnavailable } from "./client";

const NOW = 1_000_000;

function setup(options: { statuses: number[]; refresh?: AuthResult; session?: Session | null }) {
  const store = createSessionStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  if (options.session !== null) {
    store.save(options.session ?? { idToken: "old", refreshToken: "r", expiresAt: NOW + 3_600_000 });
  }
  const sent: Array<string | undefined> = [];
  const statuses = [...options.statuses];
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    sent.push(String(config.headers.get("Authorization")));
    return {
      data: {},
      status: statuses.shift() ?? 200,
      statusText: "",
      headers: {},
      config,
    } satisfies AxiosResponse;
  };
  const refresh = vi.fn(async (): Promise<AuthResult> => options.refresh ?? { kind: "error" });
  const client = createApiClient({ baseUrl: "http://api.test", session: store, refresh, now: () => NOW, adapter });
  return { client, store, sent, refresh };
}

describe("api client", () => {
  it("adds the ID token as a bearer header", async () => {
    const { client, sent } = setup({ statuses: [200] });
    await client.get("/admin/me");
    expect(sent).toEqual(["Bearer old"]);
  });

  it("throws NotSignedIn without a session", async () => {
    const { client } = setup({ statuses: [], session: null });
    await expect(client.get("/admin/me")).rejects.toBeInstanceOf(NotSignedIn);
  });

  it("refreshes first when the token is about to expire", async () => {
    const { client, sent, refresh } = setup({
      statuses: [200],
      session: { idToken: "old", refreshToken: "r", expiresAt: NOW + 1000 },
      refresh: { kind: "ok", tokens: { idToken: "new", expiresInSeconds: 3600 } },
    });
    await client.get("/admin/me");
    expect(refresh).toHaveBeenCalledWith("r");
    expect(sent).toEqual(["Bearer new"]);
  });

  it("refreshes and retries once on a 401", async () => {
    const { client, sent } = setup({
      statuses: [401, 200],
      refresh: { kind: "ok", tokens: { idToken: "new", expiresInSeconds: 3600 } },
    });
    const response = await client.get("/admin/me");
    expect(response.status).toBe(200);
    expect(sent).toEqual(["Bearer old", "Bearer new"]);
  });

  it("clears the session when a fresh token is still refused", async () => {
    const { client, store } = setup({
      statuses: [401, 401],
      refresh: { kind: "ok", tokens: { idToken: "new", expiresInSeconds: 3600 } },
    });
    await expect(client.get("/admin/me")).rejects.toBeInstanceOf(NotSignedIn);
    expect(store.load()).toBeNull();
  });

  it("clears the session when Cognito rejects the refresh token", async () => {
    const { client, store } = setup({ statuses: [401], refresh: { kind: "not-authorized" } });
    await expect(client.get("/admin/me")).rejects.toBeInstanceOf(NotSignedIn);
    expect(store.load()).toBeNull();
  });

  it("keeps the session and throws RefreshUnavailable when Cognito is unreachable", async () => {
    const { client, store } = setup({ statuses: [401], refresh: { kind: "network" } });
    await expect(client.get("/admin/me")).rejects.toBeInstanceOf(RefreshUnavailable);
    expect(store.load()).not.toBeNull();
  });
});
