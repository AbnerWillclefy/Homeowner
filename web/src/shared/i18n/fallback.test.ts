import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FALLBACK } from "./fallback";
import { LOCALES } from "./locales";

describe("FALLBACK", () => {
  it("has exactly one entry per locale", () => {
    expect(Object.keys(FALLBACK).sort()).toEqual([...LOCALES].sort());
  });

  it("has a non-empty title and body for every locale", () => {
    for (const locale of LOCALES) {
      expect(FALLBACK[locale].title.trim()).not.toBe("");
      expect(FALLBACK[locale].body.trim()).not.toBe("");
    }
  });

  it("keeps the en-US wording unchanged", () => {
    expect(FALLBACK["en-US"]).toEqual({ title: "Homeowner", body: "You have a new update." });
  });

  it("imports only ./locales, so no catalog reaches the service worker", () => {
    const source = readFileSync(new URL("./fallback.ts", import.meta.url), "utf8");
    const specifiers = [...source.matchAll(/^\s*(?:import|export)\b[^;]*?from\s+["']([^"']+)["']/gm)].map(
      (m) => m[1],
    );
    expect(specifiers).toEqual(["./locales"]);
  });
});
