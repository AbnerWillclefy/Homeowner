/** WCAG 2.x relative luminance of a #rgb or #rrggbb colour. */
function luminance(hex: string): number {
  const digits = hex.replace("#", "");
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join("") : digits;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio between two hex colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** The `--name: value` declarations of the first block that starts with `selector`, keyed without `--`. */
function declarations(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block in the CSS`);
  const end = css.indexOf("\n}", start);
  const out: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

/**
 * The colour each utility name paints in a theme, as hex: `--color-<name>: var(--<token>)` in Bedrock's `@theme inline`
 * and in the alias layer, followed through the theme block and then through its primitive (`--neutral-9`).
 * What this reads is what is loaded, so a pair checked here is a pair on screen.
 */
export function paintedColors(bedrockCss: string, aliasCss: string, theme: "dark" | "light"): Record<string, string> {
  const primitives = declarations(bedrockCss, ":root");
  const tokens = declarations(bedrockCss, `[data-theme="${theme}"]`);
  // The light block only overrides: a token it does not set keeps the dark value, as in the browser.
  const merged = theme === "light" ? { ...declarations(bedrockCss, '[data-theme="dark"]'), ...tokens } : tokens;
  const hex = (token: string) => {
    const value = merged[token];
    const resolved = value?.match(/^var\(--([a-z0-9-]+)\)$/) ? primitives[value.match(/^var\(--([a-z0-9-]+)\)$/)![1]!] : value;
    return resolved && /^#[0-9a-fA-F]{3,6}$/.test(resolved) ? resolved : undefined;
  };
  const colors: Record<string, string> = {};
  for (const css of [bedrockCss, aliasCss]) {
    for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\)\s*;/g)) {
      const value = hex(m[2]!);
      if (value) colors[m[1]!] = value;
    }
  }
  return colors;
}
