import { describe, expect, it } from "vitest";
import { LANGUAGE_NAME } from "./languageNames";
import { LOCALES } from "./locales";

describe("LANGUAGE_NAME", () => {
  it("has exactly one entry per supported locale", () => {
    expect(Object.keys(LANGUAGE_NAME).sort()).toEqual([...LOCALES].sort());
  });

  it("names each language in itself", () => {
    expect(LANGUAGE_NAME["en-US"]).toBe("English");
    expect(LANGUAGE_NAME["pt-BR"]).toBe("Português");
  });
});
