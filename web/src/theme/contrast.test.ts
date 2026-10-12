/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseTokens } from "./contrast";

// Worked examples from the WCAG definition.
describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });
  it("accepts three-digit hex and is symmetric", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#767676")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});

const css = readFileSync(resolve(import.meta.dirname, "../index.css"), "utf8");
const light = parseTokens(css, "@theme");
const dark = { ...light, ...parseTokens(css, '[data-theme="dark"]') };

const TONES = ["peach", "mint", "lavender", "blue", "yellow", "salmon"];

describe("parseTokens", () => {
  it("reads both themes and the dark override wins", () => {
    expect(light["surface"]).toMatch(/^#/);
    expect(dark["surface"]).not.toBe(light["surface"]);
  });
});

type Pair = { label: string; fg: string; bg: string; min: number };

const pairs: Pair[] = [];
for (const tone of TONES) {
  const fill = `cat-${tone}`;
  pairs.push(
    { label: `${fill}-ink text on ${fill}`, fg: `${fill}-ink`, bg: fill, min: 4.5 },
    // Icons are drawn in the ink colour, so the 3:1 bar is implied by the text bar; kept explicit.
    { label: `${fill}-ink icon on ${fill}`, fg: `${fill}-ink`, bg: fill, min: 3 },
    { label: `border on ${fill}`, fg: "border", bg: fill, min: 3 },
    { label: `focus on ${fill}`, fg: "focus", bg: fill, min: 3 },
  );
}
// The neutral "Other" card, and the text a card may carry.
pairs.push(
  { label: "text on surface-raised", fg: "text", bg: "surface-raised", min: 4.5 },
  { label: "muted on surface-raised", fg: "muted", bg: "surface-raised", min: 4.5 },
  { label: "border on surface-raised", fg: "border", bg: "surface-raised", min: 3 },
  { label: "accent-contrast on accent", fg: "accent-contrast", bg: "accent", min: 4.5 },
);

for (const [name, theme] of [
  ["light", light],
  ["dark", dark],
] as const) {
  describe(`${name} theme contrast`, () => {
    it.each(pairs)("$label is at least $min", ({ label, fg, bg, min }) => {
      expect(theme[fg], `${fg} is not declared`).toBeDefined();
      expect(theme[bg], `${bg} is not declared`).toBeDefined();
      const ratio = contrastRatio(theme[fg]!, theme[bg]!);
      expect(ratio, `${label} (${name}) is ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    });
  });
}
