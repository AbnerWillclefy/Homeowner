import { describe, expect, it, vi } from "vitest";
import type { StorageLike } from "../../domains/auth/logic/session";
import { CHUNK_RELOAD_KEY, CHUNK_RELOAD_WINDOW_MS, createChunkRecovery, shouldReload } from "./chunkReload";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

const NOW = 1_700_000_000_000;

describe("shouldReload", () => {
  it("allows the first failure and writes the marker", () => {
    const storage = memoryStorage();
    expect(shouldReload(storage, NOW)).toBe(true);
    expect(storage.getItem(CHUNK_RELOAD_KEY)).toBe(String(NOW));
  });

  it("refuses a second failure inside the window", () => {
    const storage = memoryStorage();
    shouldReload(storage, NOW);
    expect(shouldReload(storage, NOW + 5_000)).toBe(false);
    expect(shouldReload(storage, NOW + CHUNK_RELOAD_WINDOW_MS - 1)).toBe(false);
  });

  it("allows a failure once the marker is older than the window, and renews it", () => {
    const storage = memoryStorage();
    shouldReload(storage, NOW);
    const later = NOW + CHUNK_RELOAD_WINDOW_MS + 1;
    expect(shouldReload(storage, later)).toBe(true);
    expect(storage.getItem(CHUNK_RELOAD_KEY)).toBe(String(later));
  });

  it("treats a marker that is not a number as absent", () => {
    expect(shouldReload(memoryStorage({ [CHUNK_RELOAD_KEY]: "garbage" }), NOW)).toBe(true);
  });

  it("never reloads when the storage throws, so it cannot loop", () => {
    expect(shouldReload(throwingStorage, NOW)).toBe(false);
  });
});

describe("createChunkRecovery.load", () => {
  function setup(storage: StorageLike = memoryStorage()) {
    const reload = vi.fn();
    const recovery = createChunkRecovery({ storage, now: () => NOW, reload });
    return { storage, reload, recovery };
  }

  it("returns the module when the import works, and clears the marker", async () => {
    const { storage, recovery } = setup(memoryStorage({ [CHUNK_RELOAD_KEY]: String(NOW) }));
    await expect(recovery.load(() => Promise.resolve({ ok: 1 }))).resolves.toEqual({ ok: 1 });
    expect(storage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
  });

  it("reloads once on the first failure and never settles", async () => {
    const { reload, recovery } = setup();
    const settled = vi.fn();
    void recovery.load(() => Promise.reject(new Error("chunk"))).then(settled, settled);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
  });

  it("rethrows the failure when a reload already happened", async () => {
    const { reload, recovery } = setup(memoryStorage({ [CHUNK_RELOAD_KEY]: String(NOW - 1_000) }));
    await expect(recovery.load(() => Promise.reject(new Error("chunk")))).rejects.toThrow("chunk");
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads only once when two loads fail together", async () => {
    const { reload, recovery } = setup();
    void recovery.load(() => Promise.reject(new Error("a")));
    void recovery.load(() => Promise.reject(new Error("b")));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("createChunkRecovery.onPreloadError", () => {
  it("reloads and prevents the default on the first failure", () => {
    const reload = vi.fn();
    const recovery = createChunkRecovery({ storage: memoryStorage(), now: () => NOW, reload });
    const event = { preventDefault: vi.fn() };
    recovery.onPreloadError(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("leaves the error alone on a second failure", () => {
    const reload = vi.fn();
    const recovery = createChunkRecovery({ storage: memoryStorage({ [CHUNK_RELOAD_KEY]: String(NOW) }), now: () => NOW, reload });
    const event = { preventDefault: vi.fn() };
    recovery.onPreloadError(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
