import { describe, expect, it } from "vitest";
import { applyTheme, readStoredTheme, writeStoredTheme, type ThemeEnv } from "./browserTheme";

function fakeEnv(overrides: Partial<ThemeEnv> = {}) {
  const store = new Map<string, string>();
  const meta = { content: "unset" };
  const root: { dataset: Record<string, string> } = { dataset: {} };
  const env: ThemeEnv = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    root,
    setThemeColor: (color) => {
      meta.content = color;
    },
    ...overrides,
  };
  return { env, store, meta, root };
}

describe("readStoredTheme", () => {
  it("returns what is stored", () => {
    const { env, store } = fakeEnv();
    store.set("homeowner.theme", "dark");
    expect(readStoredTheme(env)).toBe("dark");
  });

  it("returns null when storage throws", () => {
    const { env } = fakeEnv({
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readStoredTheme(env)).toBeNull();
  });
});

describe("writeStoredTheme", () => {
  it("stores light and dark, and removes the key for System", () => {
    const { env, store } = fakeEnv();
    writeStoredTheme("dark", env);
    expect(store.get("homeowner.theme")).toBe("dark");
    writeStoredTheme("system", env);
    expect(store.has("homeowner.theme")).toBe(false);
  });

  it("swallows a failing write", () => {
    const { env } = fakeEnv({
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => writeStoredTheme("light", env)).not.toThrow();
  });
});

describe("applyTheme", () => {
  it("sets data-theme and the status bar colour", () => {
    const { env, meta, root } = fakeEnv();
    applyTheme("dark", env);
    expect(root.dataset.theme).toBe("dark");
    expect(meta.content).toBe("#121816");
    applyTheme("light", env);
    expect(root.dataset.theme).toBe("light");
    expect(meta.content).toBe("#f7f8f5");
  });
});
