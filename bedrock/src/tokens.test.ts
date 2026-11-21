import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Paths are relative to bedrock/, the vitest root (import.meta.url is not a file URL under jsdom).
const css = readFileSync("src/tokens.css", "utf8");
const spec = readFileSync("../docs/design/bedrock/tokens.css", "utf8");

// Copied from web/src/shared/theme/contrast.ts: web/ is not a workspace member, so it cannot be imported.
function luminance(hex: string): number {
  const digits = hex.replace("#", "");
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join("") : digits;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The `--name: value` declarations of the block that starts with `selector`, keyed without `--`. */
function block(selector: string, source: string = css): Record<string, string> {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block`);
  const end = source.indexOf("\n}", start);
  const out: Record<string, string> = {};
  for (const m of source.slice(start, end).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

const primitives = block(":root");

/** Colours of a theme as hex, following `var(--primitive)` to its value. Skips rgba (the scrim). */
function theme(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(block(selector))) {
    const ref = value.match(/^var\(--([a-z0-9-]+)\)$/);
    const hex = ref ? primitives[ref[1]!] : value;
    if (hex && /^#[0-9a-fA-F]{3,6}$/.test(hex)) out[name] = hex;
  }
  return out;
}

const themes = { dark: theme('[data-theme="dark"]'), light: theme('[data-theme="light"]') };
const cats = Object.keys(themes.dark).filter((n) => n.startsWith("cat-") && !n.endsWith("-soft"));
const surfaces = ["bg", "surface", "surface-raised", "surface-sunken", "surface-hover"];

// [foreground, background, minimum ratio]
const pairs: [string, string, number][] = [
  ...["text", "text-muted"].flatMap((fg) => surfaces.map((bg): [string, string, number] => [fg, bg, 4.5])),
  ...["brand", "brand-hover", "positive"].map((bg): [string, string, number] => ["on-brand", bg, 4.5]),
  ["on-danger", "danger", 4.5],
  ["on-hero", "hero", 4.5],
  ["on-hero-muted", "hero", 4.5],
  ["brand", "surface", 4.5],
  ["brand", "brand-soft", 4.5],
  ...["positive", "warning", "danger"].flatMap((c): [string, string, number][] => [
    [c, "surface", 4.5],
    [c, `${c}-soft`, 4.5],
  ]),
  ["bg", "text", 4.5],
  ...cats.map((c): [string, string, number] => [c, "surface", 4.5]),
  ...surfaces.map((bg): [string, string, number] => ["focus", bg, 3]),
  ["border-strong", "surface-sunken", 3],
  ["border-strong", "surface", 3],
  ["hero-line", "hero", 3],
  ...cats.map((c): [string, string, number] => [c, `${c}-soft`, 3]),
  ...["brand", "warning", "danger"].map((c): [string, string, number] => [c, "surface-sunken", 3]),
  ["chart-bar", "surface", 3],
  ["text", "chart-bar", 3],
];

describe("tokens.css", () => {
  it("declares every custom property of the spec", () => {
    const names = (src: string) => [...src.matchAll(/^\s+(--[a-z0-9-]+):/gm)].map((m) => m[1]!);
    const ours = new Set(names(css));
    expect(names(spec).filter((n) => !ours.has(n))).toEqual([]);
  });

  // Values, not just names: a spec fix must be re-copied into src/tokens.css.
  it.each([':root, [data-theme="dark"]', '[data-theme="light"]'])("%s matches the spec", (sel) => {
    expect(block(sel)).toEqual(block(sel, spec));
  });

  it("primitives match the spec, bar what moved to @theme static", () => {
    const moved = /^(radius-|ease-|font-sans$)/;
    const want = Object.fromEntries(Object.entries(block(":root", spec)).filter(([n]) => !moved.test(n)));
    expect(primitives).toEqual(want);
  });

  it("puts dark on :root and light under data-theme=light", () => {
    expect(css).toContain(':root, [data-theme="dark"] {');
    expect(css.indexOf('[data-theme="light"] {')).toBeGreaterThan(css.indexOf('[data-theme="dark"] {'));
  });

  it("the contrast helper matches known ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });

  for (const name of ["dark", "light"] as const) {
    describe(name, () => {
      for (const [fg, bg, min] of pairs) {
        // Spec defect (raised on the pull request): light border-strong on surface-sunken is 2.63:1.
        // it.fails keeps the bar at 3:1 and turns red once src/tokens.css is re-copied from the fixed spec, so this entry gets deleted.
        const run = name === "light" && fg === "border-strong" && bg === "surface-sunken" ? it.fails : it;
        run(`${fg} on ${bg} is at least ${min}:1`, () => {
          const t = themes[name];
          expect(t[fg], `${fg} missing`).toBeDefined();
          expect(t[bg], `${bg} missing`).toBeDefined();
          expect(contrastRatio(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(min);
        });
      }
    });
  }
});
