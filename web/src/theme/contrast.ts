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

/** The `--color-*: #hex` declarations inside the first block that starts with `selector`, keyed without the prefix. */
export function parseTokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block in the CSS`);
  const end = css.indexOf("}", start);
  const tokens: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    tokens[m[1]!] = m[2]!;
  }
  return tokens;
}
