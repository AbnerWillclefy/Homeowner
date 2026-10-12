/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_KEYS } from "../profile/labels";
import { categoryStyle } from "./categoryStyle";

const css = readFileSync(resolve(import.meta.dirname, "../index.css"), "utf8");

// The request's table, written out independently of the implementation.
const TONES: Record<string, string> = {
  kitchen: "peach",
  bathroom: "mint",
  bedroom: "lavender",
  living_room: "lavender",
  laundry: "blue",
  floors: "blue",
  trash: "yellow",
  outdoor: "yellow",
  pets: "salmon",
  other: "neutral",
};

describe("categoryStyle", () => {
  it("covers every Category the app has a label for, so a new Category without a style fails here", () => {
    expect(Object.keys(TONES).sort()).toEqual(Object.keys(CATEGORY_KEYS).sort());
  });

  it.each(Object.entries(TONES))("%s is %s", (id, tone) => {
    const style = categoryStyle(id);
    expect(style.tone).toBe(tone);
    expect(style.icon).toBeTruthy();
  });

  it.each([undefined, "", "garage", "toString"])("gives %j the neutral style", (id) => {
    const style = categoryStyle(id);
    expect(style.tone).toBe("neutral");
    expect(style).toEqual(categoryStyle("other"));
  });

  it("gives every Category its own icon", () => {
    const ids = Object.keys(TONES);
    expect(new Set(ids.map((id) => categoryStyle(id).icon)).size).toBe(ids.length);
  });

  describe("id", () => {
    it.each(Object.keys(TONES))("keeps the known id %s", (id) => {
      expect(categoryStyle(id).id).toBe(id);
    });

    it.each([undefined, null, "", "garage", "toString", "__proto__"])("turns %j into other, never the raw id", (id) => {
      expect(categoryStyle(id).id).toBe("other");
    });

    it("names every Category it styles", () => {
      expect(Object.keys(CATEGORY_KEYS).sort()).toEqual(Object.keys(TONES).sort());
    });
  });

  it("uses only classes whose tokens exist in index.css", () => {
    for (const id of [...Object.keys(TONES), "unknown"]) {
      const { fill, ink } = categoryStyle(id);
      for (const cls of [fill, ink]) {
        const token = cls.replace(/^(bg|text)-/, "");
        expect(css, `${id}: --color-${token} is not declared`).toContain(`--color-${token}:`);
      }
    }
  });
});
