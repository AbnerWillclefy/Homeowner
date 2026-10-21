import { describe, expect, it, vi } from "vitest";
import type { RefreshResult } from "../api/cognito";
import { createSessionStore, type Session, type StorageLike } from "./session";
import { createTokenKeeper, REFRESH_MARGIN_MS } from "./tokenKeeper";

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const NOW = 1_000_000;
const fresh: Session = { idToken: "id-1", refreshToken: "rt-1", expiresAt: NOW + 30 * 60_000 };
const nearExpiry: Session = { idToken: "id-old", refreshToken: "rt-1", expiresAt: NOW + 20_000 };
const ok: RefreshResult = { kind: "ok", tokens: { idToken: "id-new", expiresInSeconds: 3600 } };

function setup(initial: Session | null, result: RefreshResult = ok) {
  const store = createSessionStore(memoryStorage(), () => NOW);
  if (initial) store.save(initial);
  const refresh = vi.fn(async (_rt: string): Promise<RefreshResult> => result);
  const keeper = createTokenKeeper({ session: store, refresh, now: () => NOW });
  return { store, refresh, keeper };
}

describe("token keeper, before a request", () => {
  it("has no session to give when signed out", async () => {
    const { keeper, refresh } = setup(null);
    expect(await keeper.usableSession()).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("gives a token with plenty of life left without refreshing", async () => {
    const { keeper, refresh } = setup(fresh);
    expect(await keeper.usableSession()).toEqual(fresh);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes first inside the margin, and saves the new token with the new expiry", async () => {
    expect(REFRESH_MARGIN_MS).toBe(60_000);
    const { keeper, refresh, store } = setup(nearExpiry);
    const session = await keeper.usableSession();
    expect(refresh).toHaveBeenCalledExactlyOnceWith("rt-1");
    expect(session).toEqual({ idToken: "id-new", refreshToken: "rt-1", expiresAt: NOW + 3_600_000 });
    expect(store.load()).toEqual(session);
  });

  it("keeps a rotated refresh token", async () => {
    const { keeper, store } = setup(nearExpiry, {
      kind: "ok",
      tokens: { idToken: "id-new", refreshToken: "rt-2", expiresInSeconds: 60 },
    });
    await keeper.usableSession();
    expect(store.load()?.refreshToken).toBe("rt-2");
  });

  it("gives nothing and clears the session when Cognito rejects the token", async () => {
    const { keeper, store } = setup(nearExpiry, { kind: "not-authorized" });
    expect(await keeper.usableSession()).toBeNull();
    expect(store.load()).toBeNull();
  });

  it("keeps the session when Cognito cannot be reached", async () => {
    const { keeper, store } = setup(nearExpiry, { kind: "network" });
    expect(await keeper.usableSession()).toEqual(nearExpiry);
    expect(store.load()).toEqual(nearExpiry);
  });
});

describe("token keeper, after a 401", () => {
  it("shares one refresh between concurrent callers", async () => {
    const store = createSessionStore(memoryStorage(), () => NOW);
    store.save(fresh);
    let release: (r: RefreshResult) => void = () => {};
    const refresh = vi.fn(() => new Promise<RefreshResult>((resolve) => (release = resolve)));
    const keeper = createTokenKeeper({ session: store, refresh, now: () => NOW });

    const answers = Promise.all([1, 2, 3, 4].map(() => keeper.afterUnauthorized(fresh)));
    release(ok);
    expect(await answers).toEqual(["refreshed", "refreshed", "refreshed", "refreshed"]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("tells Cognito rejecting the token apart from Cognito being unreachable", async () => {
    const rejected = setup(fresh, { kind: "not-authorized" });
    expect(await rejected.keeper.afterUnauthorized(fresh)).toBe("rejected");
    expect(rejected.store.load()).toBeNull();

    const down = setup(fresh, { kind: "network" });
    expect(await down.keeper.afterUnauthorized(fresh)).toBe("unavailable");
    expect(down.store.load()).toEqual(fresh);
  });

  it("detects a token replaced meanwhile and does not refresh again", async () => {
    const { keeper, refresh, store } = setup(fresh);
    store.save({ ...fresh, idToken: "id-replaced" });
    expect(await keeper.afterUnauthorized(fresh)).toBe("refreshed");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("is rejected when the session is gone", async () => {
    const { keeper, store } = setup(fresh);
    store.clear();
    expect(await keeper.afterUnauthorized(fresh)).toBe("rejected");
  });

  it("refreshes again for a later 401, once the first refresh has settled", async () => {
    const { keeper, refresh, store } = setup(fresh);
    await keeper.afterUnauthorized(fresh);
    await keeper.afterUnauthorized(store.load()!);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
