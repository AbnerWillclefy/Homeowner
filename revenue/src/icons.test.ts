/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

type IconRef = { source: string; src: string; size?: string };

// Manifest icons: every `{ src: "...", sizes: "WxH" ... }` entry in vite.config.ts.
const manifestIcons: IconRef[] = [...read("vite.config.ts").matchAll(/\{\s*src:\s*"([^"]+)",\s*sizes:\s*"([^"]+)"/g)].map((m) => ({
  source: "manifest",
  src: m[1]!,
  size: m[2]!,
}));
const appleIcon: IconRef = {
  source: "index.html",
  src: /<link\b[^>]*rel="apple-touch-icon"[^>]*href="([^"]+)"/.exec(read("index.html"))?.[1] ?? "(missing)",
  size: "180x180",
};

describe("PWA icons", () => {
  it("finds the icons the manifest and index.html declare", () => {
    expect(manifestIcons).toHaveLength(3);
    expect(appleIcon.src).toBe("/apple-touch-icon.png");
  });

  it.each([...manifestIcons, appleIcon])("$source icon $src exists in public as a PNG of its declared size", ({ src, size }) => {
    const file = resolve(root, "public", src.replace(/^\//, ""));
    expect(existsSync(file), `${file} is missing`).toBe(true);
    const png = readFileSync(file);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(size);
  });

  it("differs from Homeowner's icons", () => {
    for (const name of ["icon-192.png", "icon-512.png", "icon-512-maskable.png", "apple-touch-icon.png"]) {
      expect(readFileSync(resolve(root, "public", name)).equals(readFileSync(resolve(root, "../web/public", name)))).toBe(false);
    }
  });
});
