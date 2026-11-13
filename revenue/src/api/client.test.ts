import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";
import type { AuthResult } from "../auth/cognito";
import { createSessionStore, type Session, type SessionStore } from "../auth/session";
import { createApiClient, NotSignedIn, RefreshUnavailable } from "./client";

const NOW = 1_000_000;

function setup(options: { statuses: number[]; refresh?: AuthResult; session?: Session | null; onSend?: (n: number) => void }) {
  const store = createSessionStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  if (options.session !== null) {
    store.save(options.session ?? { idToken: "old", refreshToken: "r", expiresAt: NOW + 3_600_000 });
  }
  const sent: Array<string | undefined> = [];
  const statuses = [...options.statuses];
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    sent.push(String(config.headers.get("Authorization")));
    options.onSend?.(sent.length);
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
    await client.get("/me/finance");
    expect(sent).toEqual(["Bearer old"]);
  });

  it("throws NotSignedIn without a session", async () => {
    const { client } = setup({ statuses: [], session: null });
    await expect(client.get("/me/finance")).rejects.toBeInstanceOf(NotSignedIn);
  });

  it("refreshes first when the token is about to expire", async () => {
    const { client, sent, refresh } = setup({
      statuses: [200],
      session: { idToken: "old", refreshToken: "r", expiresAt: NOW + 1000 },
      refresh: { kind: "ok", tokens: { idToken: "new", expiresInSeconds: 3600 } },
    });
    await client.get("/me/finance");
    expect(refresh).toHaveBeenCalledWith("r");
    expect(sent).toEqual(["Bearer new"]);
  });

  it("refreshes and retries once on a 401", async () => {
    const { client, sent } = setup({
      statuses: [401, 200],
      refresh: { kind: "ok", tokens: { idToken: "new", expiresInSeconds: 3600 } },
    });
    const response = await client.get("/me/finance");
    expect(response.status).toBe(200);
    expect(sent).toEqual(["Bearer old", "Bearer new"]);
  });

  it("clears the session when a fresh token is still refused", async () => {
    const { client, store } = setup({
      statuses: [401, 401],
      refresh: { kind: "ok", tokens: { idToken: "new", expiresInSeconds: 3600 } },
    });
    await expect(client.get("/me/finance")).rejects.toBeInstanceOf(NotSignedIn);
    expect(store.load()).toBeNull();
  });

  it("clears the session when Cognito rejects the refresh token", async () => {
    const { client, store } = setup({ statuses: [401], refresh: { kind: "not-authorized" } });
    await expect(client.get("/me/finance")).rejects.toBeInstanceOf(NotSignedIn);
    expect(store.load()).toBeNull();
  });

  it("keeps the session and throws RefreshUnavailable when Cognito is unreachable", async () => {
    const { client, store } = setup({ statuses: [401], refresh: { kind: "network" } });
    await expect(client.get("/me/finance")).rejects.toBeInstanceOf(RefreshUnavailable);
    expect(store.load()).not.toBeNull();
  });

  it("shares one refresh between concurrent 401s", async () => {
    const { client, sent, refresh } = setup({
      statuses: [401, 401, 200, 200],
      refresh: { kind: "ok", tokens: { idToken: "new", expiresInSeconds: 3600 } },
    });
    const responses = await Promise.all([client.get("/a"), client.get("/b")]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sent).toEqual(["Bearer old", "Bearer old", "Bearer new", "Bearer new"]);
  });

  it("retries a 401 without refreshing when another request already replaced the token", async () => {
    // Another request replaces the token while this one is in flight.
    const swap = (n: number) => n === 1 && holder.store?.save({ idToken: "newer", refreshToken: "r", expiresAt: NOW + 3_600_000 });
    const holder: { store?: SessionStore } = {};
    const { client, store, sent, refresh } = setup({ statuses: [401, 200], onSend: swap });
    holder.store = store;
    const response = await client.get("/a");
    expect(response.status).toBe(200);
    expect(refresh).not.toHaveBeenCalled();
    expect(sent).toEqual(["Bearer old", "Bearer newer"]);
  });
});
