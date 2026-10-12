import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ADR 0007: components use semantic classes (bg-surface, text-muted), never raw palette
// classes, and never dark: variants, because the tokens swap per theme.
const PALETTE =
  /^(bg|text|border|ring|fill|stroke|outline|divide|from|to|via|accent|caret|decoration|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-|$)/;

function forbiddenClass(token: string): boolean {
  const parts = token.split(":");
  const base = parts[parts.length - 1]!;
  return parts.slice(0, -1).includes("dark") || PALETTE.test(base);
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("forbiddenClass", () => {
  it.each(["bg-teal-600", "text-white", "border-gray-300", "hover:bg-red-500", "dark:bg-surface"])("flags %s", (token) => {
    expect(forbiddenClass(token)).toBe(true);
  });

  it.each(["bg-surface", "text-text", "text-muted", "text-sm", "border-border", "text-accent-contrast", "bg-accent"])(
    "allows %s",
    (token) => {
      expect(forbiddenClass(token)).toBe(false);
    },
  );
});

describe("components", () => {
  it("use only semantic classes", () => {
    const offences: string[] = [];
    for (const file of tsxFiles(new URL("../..", import.meta.url).pathname)) {
      const source = readFileSync(file, "utf8");
      for (const attr of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        for (const token of (attr[1] ?? attr[2] ?? "").split(/\s+/).filter(Boolean)) {
          if (forbiddenClass(token)) offences.push(`${file}: ${token}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });
});
