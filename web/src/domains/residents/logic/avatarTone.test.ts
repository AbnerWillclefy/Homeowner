import { describe, expect, it } from "vitest";
import { PASTEL_TONES } from "../../chores/logic/categoryStyle";
import { avatarTone, fnv1a } from "./avatarTone";

describe("fnv1a", () => {
  // Published FNV-1a 32-bit test vectors, so the hash is checked against an outside source.
  it.each([
    ["", 0x811c9dc5],
    ["a", 0xe40c292c],
    ["foobar", 0xbf9cf968],
  ])("hashes %j to the known value", (text, hash) => {
    expect(fnv1a(text)).toBe(hash);
  });
});

describe("avatarTone", () => {
  it("is the same tone for the same id every time", () => {
    expect(avatarTone("user-1")).toBe(avatarTone("user-1"));
  });

  // Pinned: changing the hash or the tone order recolours everybody, so it must fail here first.
  it.each([
    ["", "mint"], // 0x811c9dc5 = 2166136261, remainder 1 mod 6
    ["a", "yellow"], // 0xe40c292c = 3826002220, remainder 4 mod 6
    ["foobar", "yellow"],
  ])("pins %j to %s", (id, tone) => {
    expect(avatarTone(id)).toBe(tone);
  });

  it("is always one of the six pastels, never neutral", () => {
    for (let i = 0; i < 500; i++) {
      expect(PASTEL_TONES).toContain(avatarTone(`7d3f0c2e-${i}-4b1a-9c55-0e6a1f2b3c4d`));
    }
  });

  it("spreads a sample of ids over all six pastels", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(avatarTone(`7d3f0c2e-${i}-4b1a-9c55-0e6a1f2b3c4d`));
    expect(seen.size).toBe(6);
  });
});
