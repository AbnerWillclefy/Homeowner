/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_KEYS } from "../../profile/logic/labels";
import { choreCategory } from "./choreCategory";

// Read the file rather than import the Home layer: web does not depend on Bedrock yet.
const css = readFileSync(resolve(import.meta.dirname, "../../../../../bedrock/src/tokens.css"), "utf8");
const blocks = [':root, [data-theme="dark"] {', '[data-theme="light"] {'].map((sel) => {
  const start = css.indexOf(sel);
  return css.slice(start, css.indexOf("\n}", start));
});

const ids = Object.keys(CATEGORY_KEYS);

describe("choreCategory", () => {
  it("knows the 10 Categories the app has a label for", () => {
    expect(ids).toHaveLength(10);
  });

  it.each(ids)("%s has an icon and a chore-* tone declared with its -soft in both themes", (id) => {
    const { tone, icon } = choreCategory(id);
    expect(icon).toBeTruthy();
    for (const block of blocks) {
      expect(block, `--chore-${tone}`).toContain(`--chore-${tone}:`);
      expect(block, `--chore-${tone}-soft`).toContain(`--chore-${tone}-soft:`);
    }
  });

  it("gives every Category its own tone and icon", () => {
    expect(new Set(ids.map((id) => choreCategory(id).tone)).size).toBe(ids.length);
    expect(new Set(ids.map((id) => choreCategory(id).icon)).size).toBe(ids.length);
  });

  it.each([undefined, null, "", "garage", "toString", "__proto__"])("turns %j into other, never the raw id", (id) => {
    expect(choreCategory(id)).toEqual(choreCategory("other"));
    expect(choreCategory(id).id).toBe("other");
    expect(choreCategory(id).tone).toBe("other");
  });
});
