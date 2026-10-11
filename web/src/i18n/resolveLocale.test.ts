import { describe, expect, it } from "vitest";
import { resolveLocale } from "./resolveLocale";

describe("resolveLocale from browser languages", () => {
  it.each([
    [["pt-BR"], "pt-BR"],
    [["pt"], "pt-BR"],
    [["pt-PT"], "pt-BR"],
    [["PT-br"], "pt-BR"],
    [["pt_BR"], "pt-BR"],
    [["en-US"], "en-US"],
    [["en-GB"], "en-US"],
    [["en"], "en-US"],
    [["fr-FR"], "en-US"],
    [["de", "ja"], "en-US"],
    [[], "en-US"],
    [undefined, "en-US"],
    [[""], "en-US"],
    [["fr", "pt-PT"], "pt-BR"],
    [["en-GB", "pt-BR"], "en-US"],
    [["!!", "pt"], "pt-BR"],
  ] as const)("%j gives %s", (languages, expected) => {
    expect(resolveLocale({ languages })).toBe(expected);
  });

  it("never throws on malformed or non-string entries", () => {
    expect(resolveLocale({ languages: ["!!"] })).toBe("en-US");
    expect(resolveLocale({ languages: [null, 42, undefined] as unknown as string[] })).toBe("en-US");
    expect(resolveLocale({ languages: null })).toBe("en-US");
  });
});

describe("resolveLocale with a stored choice", () => {
  it("prefers a valid stored value over the browser", () => {
    expect(resolveLocale({ languages: ["en-US"], stored: "pt-BR" })).toBe("pt-BR");
    expect(resolveLocale({ languages: ["pt-BR"], stored: "en-US" })).toBe("en-US");
  });

  it("ignores an invalid stored value", () => {
    expect(resolveLocale({ languages: ["pt-BR"], stored: "fr" })).toBe("pt-BR");
    expect(resolveLocale({ languages: ["en"], stored: 42 })).toBe("en-US");
    expect(resolveLocale({ languages: ["pt"], stored: null })).toBe("pt-BR");
  });
});
