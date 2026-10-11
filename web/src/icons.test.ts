/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

type IconRef = { source: string; src: string; size?: string };

// Manifest icons: every `{ src: "...", sizes: "WxH" ... }` entry in vite.config.ts.
function manifestIcons(): IconRef[] {
  const config = read("vite.config.ts");
  const entries = [...config.matchAll(/\{\s*src:\s*"([^"]+)",\s*sizes:\s*"([^"]+)"/g)];
  return entries.map((m) => ({ source: "manifest", src: m[1]!, size: m[2]! }));
}

// Icon links in index.html (apple-touch-icon carries a declared size, the favicon may not).
function htmlIcons(): IconRef[] {
  const links = [...read("index.html").matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
  return links
    .filter((tag) => /rel="(apple-touch-icon|icon)"/.test(tag))
    .map((tag) => ({
      source: "index.html",
      src: /href="([^"]+)"/.exec(tag)![1]!,
      size: /sizes="([^"]+)"/.exec(tag)?.[1],
    }));
}

const icons = [...manifestIcons(), ...htmlIcons()];

describe("PWA icons", () => {
  it("finds the icons the manifest and index.html declare", () => {
    expect(manifestIcons()).toHaveLength(3);
    expect(htmlIcons().map((i) => i.src)).toContain("/apple-touch-icon.png");
  });

  it.each(icons)("$source icon $src exists in public as a PNG of its declared size", ({ src, size }) => {
    const file = resolve(root, "public", src.replace(/^\//, ""));
    expect(existsSync(file), `${file} is missing`).toBe(true);

    const png = readFileSync(file);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    if (size) {
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(size);
    }
  });
});
