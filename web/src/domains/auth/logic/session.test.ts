import { describe, expect, it, vi } from "vitest";
import { SESSION_KEY, createSessionStore, emailFromIdToken, type StorageLike } from "./session";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const session = { idToken: "id", refreshToken: "rt", expiresAt: 1_000_000 };

describe("session store", () => {
  it("round-trips a saved session", () => {
    const store = createSessionStore(memoryStorage(), () => 0);
    expect(store.load()).toBeNull();
    store.save(session);
    expect(store.load()).toEqual(session);
  });

  it("keeps everything under one key", () => {
    const storage = memoryStorage();
    createSessionStore(storage, () => 0).save(session);
    expect([...storage.data.keys()]).toEqual([SESSION_KEY]);
  });

  it("is signed out after clear", () => {
    const store = createSessionStore(memoryStorage(), () => 0);
    store.save(session);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it.each([
    ["not JSON", "{oops"],
    ["not an object", "42"],
    ["missing a field", JSON.stringify({ idToken: "id", refreshToken: "rt" })],
    ["a wrong type", JSON.stringify({ idToken: "id", refreshToken: "rt", expiresAt: "soon" })],
    ["an empty token", JSON.stringify({ idToken: "", refreshToken: "rt", expiresAt: 1 })],
  ])("treats %s as signed out and clears it", (_name, raw) => {
    const storage = memoryStorage({ [SESSION_KEY]: raw });
    const store = createSessionStore(storage, () => 0);
    expect(store.load()).toBeNull();
    expect(storage.data.has(SESSION_KEY)).toBe(false);
  });

  it("does not throw when storage is unavailable", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const store = createSessionStore(broken, () => 0);
    expect(store.load()).toBeNull();
    expect(() => store.save(session)).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });

  it("tells listeners when the session is saved or cleared", () => {
    const store = createSessionStore(memoryStorage(), () => 0);
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.save(session);
    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    store.save(session);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  describe("expiry", () => {
    it("is not expiring when well inside its life", () => {
      const store = createSessionStore(memoryStorage(), () => 0);
      expect(store.expiresWithin(session, 60_000)).toBe(false);
    });

    it("is expiring inside the margin", () => {
      const store = createSessionStore(memoryStorage(), () => 950_000);
      expect(store.expiresWithin(session, 60_000)).toBe(true);
    });

    it("is expiring once past its time", () => {
      const store = createSessionStore(memoryStorage(), () => 2_000_000);
      expect(store.expiresWithin(session, 0)).toBe(true);
    });
  });
});

function fakeJwt(payload: unknown): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${b64({ alg: "RS256" })}.${b64(payload)}.sig`;
}

describe("emailFromIdToken", () => {
  it("reads the email claim", () => {
    expect(emailFromIdToken(fakeJwt({ email: "a@example.com", sub: "s" }))).toBe("a@example.com");
  });

  it.each([["garbage"], [""], ["a.b.c"], [fakeJwt({ sub: "s" })], [fakeJwt({ email: 5 })]])(
    "returns null for %s",
    (token) => {
      expect(emailFromIdToken(token)).toBeNull();
    },
  );
});
