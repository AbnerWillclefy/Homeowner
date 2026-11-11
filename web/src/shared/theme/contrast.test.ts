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

const css = readFileSync(resolve(import.meta.dirname, "../../tokens.css"), "utf8");
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
    { label: `border on ${fill}`, fg: "border", bg: fill, min: 3 },
    { label: `focus on ${fill}`, fg: "focus", bg: fill, min: 3 },
  );
}
// The neutral "Other" card, and the text a card may carry.
pairs.push(
  { label: "text on surface-raised", fg: "text", bg: "surface-raised", min: 4.5 },
  { label: "muted on surface-raised", fg: "muted", bg: "surface-raised", min: 4.5 },
  { label: "border on surface-raised", fg: "border", bg: "surface-raised", min: 3 },
  { label: "danger on surface-raised", fg: "danger", bg: "surface-raised", min: 4.5 },
  { label: "danger on surface", fg: "danger", bg: "surface", min: 4.5 },
  // Onboarding text sits straight on the gradient, so both stops are checked.
  ...["welcome-from", "welcome-to"].flatMap((stop) => [
    { label: `text on ${stop}`, fg: "text", bg: stop, min: 4.5 },
    { label: `muted on ${stop}`, fg: "muted", bg: stop, min: 4.5 },
    { label: `danger on ${stop}`, fg: "danger", bg: stop, min: 4.5 },
    { label: `border on ${stop}`, fg: "border", bg: stop, min: 3 },
    { label: `focus on ${stop}`, fg: "focus", bg: stop, min: 3 },
  ]),
  { label: "accent-contrast on accent", fg: "accent-contrast", bg: "accent", min: 4.5 },
  // Charts (WCAG 1.4.11, non-text): a mark must read against the card and a filled bar against its own track.
  { label: "chart-ink on surface-raised", fg: "chart-ink", bg: "surface-raised", min: 3 },
  { label: "chart-muted on surface-raised", fg: "chart-muted", bg: "surface-raised", min: 3 },
  { label: "chart-ink on chart-track", fg: "chart-ink", bg: "chart-track", min: 3 },
  { label: "chart-muted on chart-track", fg: "chart-muted", bg: "chart-track", min: 3 },
);

// Spending Category colours (1.4.11): the ring part and bar fill on the card, the icon stroke on its own tint.
const SPENDING = ["housing", "household-bills", "groceries", "eating-out", "transport", "health", "education", "leisure", "shopping", "subscriptions", "pets", "taxes-fees", "other"];
for (const id of SPENDING) {
  pairs.push(
    { label: `spend-${id} on surface-raised`, fg: `spend-${id}`, bg: "surface-raised", min: 3 },
    { label: `spend-${id} on spend-${id}-tint`, fg: `spend-${id}`, bg: `spend-${id}-tint`, min: 3 },
  );
}

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
