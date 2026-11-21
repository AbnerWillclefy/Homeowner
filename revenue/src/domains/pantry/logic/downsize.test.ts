import { describe, expect, it } from "vitest";
import { downsize, MAX_BYTES, type Source } from "./downsize";

/** A source whose encoder answers `sizeAt(quality, longSide)` bytes, and records every attempt. */
function source(width: number, height: number, sizeAt: (quality: number, side: number) => number | null) {
  const tries: Array<{ width: number; height: number; quality: number }> = [];
  const src: Source = {
    width,
    height,
    async encode(w, h, quality) {
      tries.push({ width: w, height: h, quality });
      const size = sizeAt(quality, Math.max(w, h));
      return size === null ? null : new Blob([new Uint8Array(size)], { type: "image/jpeg" });
    },
  };
  return { src, tries };
}

describe("downsize", () => {
  it("keeps the first quality when it already fits, and caps the long side at 2400", async () => {
    const { src, tries } = source(4000, 3000, () => 900_000);
    const blob = await downsize(src);
    expect(blob?.size).toBe(900_000);
    expect(tries).toEqual([{ width: 2400, height: 1800, quality: 0.85 }]);
  });

  it("does not enlarge a small photo", async () => {
    const { src, tries } = source(800, 600, () => 100);
    await downsize(src);
    expect(tries[0]).toMatchObject({ width: 800, height: 600 });
  });

  it("steps the quality down until the blob fits", async () => {
    const { src, tries } = source(3000, 4000, (q) => (q > 0.6 ? 2_000_000 : 1_400_000));
    const blob = await downsize(src);
    expect(tries.map((t) => t.quality)).toEqual([0.85, 0.7, 0.55]);
    expect(tries[0]).toMatchObject({ width: 1800, height: 2400 });
    expect(blob!.size).toBeLessThanOrEqual(MAX_BYTES);
  });

  it("shrinks the side once when the lowest quality is still too big", async () => {
    const { src, tries } = source(4000, 3000, (_q, side) => (side > 1600 ? 2_000_000 : 1_000_000));
    const blob = await downsize(src);
    expect(tries.map((t) => [Math.max(t.width, t.height), t.quality])).toEqual([[2400, 0.85], [2400, 0.7], [2400, 0.55], [1600, 0.85]]);
    expect(blob!.size).toBe(1_000_000);
  });

  it("gives up with null when even the smaller side is too big, or the browser cannot encode", async () => {
    expect(await downsize(source(4000, 3000, () => 2_000_000).src)).toBeNull();
    expect(await downsize(source(4000, 3000, () => null).src)).toBeNull();
  });
});
