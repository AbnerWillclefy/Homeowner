import { describe, expect, it } from "vitest";
import { LOCALE_STORAGE_KEY, readStoredLocale, writeStoredLocale } from "./localeStorage";
import { resolveLocale } from "./resolveLocale";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: (): void => {
    throw new Error("quota");
  },
};

describe("localeStorage", () => {
  it("uses the key homeowner.locale", () => {
    expect(LOCALE_STORAGE_KEY).toBe("homeowner.locale");
  });

  it("round trips, storing the bare tag", () => {
    const storage = fakeStorage();
    writeStoredLocale("pt-BR", storage);
    expect(storage.data.get("homeowner.locale")).toBe("pt-BR");
    expect(readStoredLocale(storage)).toBe("pt-BR");
  });

  it("reads undefined when nothing is stored", () => {
    expect(readStoredLocale(fakeStorage())).toBeUndefined();
  });

  it("returns the raw value without validating it", () => {
    expect(readStoredLocale(fakeStorage({ "homeowner.locale": "fr" }))).toBe("fr");
  });

  it("never throws when storage throws", () => {
    expect(readStoredLocale(throwing)).toBeUndefined();
    expect(() => writeStoredLocale("en-US", throwing)).not.toThrow();
  });

  it("never throws when there is no storage at all", () => {
    expect(readStoredLocale()).toBeUndefined();
    expect(() => writeStoredLocale("en-US")).not.toThrow();
  });

  it("never throws when reading the storage global itself throws", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    try {
      expect(readStoredLocale()).toBeUndefined();
      expect(() => writeStoredLocale("pt-BR")).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete (globalThis as Record<string, unknown>).localStorage;
    }
  });

  describe("through resolveLocale", () => {
    it("a stored choice beats the browser language", () => {
      const storage = fakeStorage({ "homeowner.locale": "pt-BR" });
      expect(resolveLocale({ languages: ["en"], stored: readStoredLocale(storage) })).toBe("pt-BR");
    });

    it("garbage and a throwing storage fall back to the browser language", () => {
      const garbage = fakeStorage({ "homeowner.locale": "garbage" });
      expect(resolveLocale({ languages: ["en"], stored: readStoredLocale(garbage) })).toBe("en-US");
      expect(resolveLocale({ languages: ["pt"], stored: readStoredLocale(garbage) })).toBe("pt-BR");
      expect(resolveLocale({ languages: ["en"], stored: readStoredLocale(throwing) })).toBe("en-US");
    });
  });
});
