import { describe, expect, it } from "vitest";
import { readStoredTheme, resolveTheme, THEME_STORAGE_KEY, writeStoredTheme } from "./theme";

const memory = () => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};

describe("theme", () => {
  it("follows the system, and falls back to dark", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
  });
  it("lets an explicit choice win", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });
  it("stores under revenue.theme, and clears it for system", () => {
    const storage = memory();
    writeStoredTheme("light", storage);
    expect([...storage.data]).toEqual([[THEME_STORAGE_KEY, "light"]]);
    expect(THEME_STORAGE_KEY).toBe("revenue.theme");
    expect(readStoredTheme(storage)).toBe("light");
    writeStoredTheme("system", storage);
    expect(storage.data.size).toBe(0);
  });
  it("ignores a stored value it does not know", () => {
    const storage = memory();
    storage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readStoredTheme(storage)).toBe("system");
  });
});
