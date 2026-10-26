import { describe, expect, it, vi } from "vitest";
import { createSessionStore, SESSION_KEY, type StorageLike } from "./session";

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const session = { idToken: "i", refreshToken: "r", expiresAt: 1000 };

describe("session store", () => {
  it("keeps the session under an admin-prefixed key", () => {
    const storage = memory();
    createSessionStore(storage).save(session);
    expect([...storage.data.keys()]).toEqual([SESSION_KEY]);
    expect(SESSION_KEY.startsWith("admin.")).toBe(true);
  });

  it("loads what an earlier store saved", () => {
    const storage = memory();
    createSessionStore(storage).save(session);
    expect(createSessionStore(storage).load()).toEqual(session);
  });

  it("treats a malformed value as signed out", () => {
    const storage = memory();
    storage.setItem(SESSION_KEY, '{"idToken":1}');
    expect(createSessionStore(storage).load()).toBeNull();
    storage.setItem(SESSION_KEY, "not json");
    expect(createSessionStore(storage).load()).toBeNull();
  });

  it("clear removes the tokens and tells subscribers", () => {
    const storage = memory();
    const store = createSessionStore(storage);
    store.save(session);
    const listener = vi.fn();
    store.subscribe(listener);
    store.clear();
    expect(storage.data.size).toBe(0);
    expect(store.load()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns the same object until something changes", () => {
    const store = createSessionStore(memory());
    store.save(session);
    expect(store.load()).toBe(store.load());
  });
});
