import { describe, expect, it } from "vitest";
import { cropBox, fitsLimit, MAX_PHOTO_BYTES, pickEncoding } from "./photoImage";

describe("cropBox", () => {
  it("centres a square on a landscape image", () => {
    expect(cropBox(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 });
  });

  it("centres a square on a portrait image", () => {
    expect(cropBox(3000, 4000)).toEqual({ sx: 0, sy: 500, size: 3000 });
  });

  it("keeps a square image whole", () => {
    expect(cropBox(512, 512)).toEqual({ sx: 0, sy: 0, size: 512 });
  });

  it("rounds an odd margin down so the box stays on whole pixels", () => {
    expect(cropBox(101, 50)).toEqual({ sx: 25, sy: 0, size: 50 });
  });

  it("handles a 1xN strip", () => {
    expect(cropBox(1, 9)).toEqual({ sx: 0, sy: 4, size: 1 });
    expect(cropBox(9, 1)).toEqual({ sx: 4, sy: 0, size: 1 });
  });
});

describe("pickEncoding", () => {
  it("keeps WebP when the canvas produced it", () => {
    expect(pickEncoding("image/webp")).toEqual({ type: "image/webp", quality: 0.85 });
  });

  it("falls back to JPEG at 0.85 when Safari answers PNG", () => {
    expect(pickEncoding("image/png")).toEqual({ type: "image/jpeg", quality: 0.85 });
  });

  it("falls back to JPEG for an empty or unknown type", () => {
    expect(pickEncoding("")).toEqual({ type: "image/jpeg", quality: 0.85 });
    expect(pickEncoding("image/avif")).toEqual({ type: "image/jpeg", quality: 0.85 });
  });

  it("keeps a JPEG the canvas already produced", () => {
    expect(pickEncoding("image/jpeg")).toEqual({ type: "image/jpeg", quality: 0.85 });
  });
});

describe("fitsLimit", () => {
  it("is the API's 512 KB", () => {
    expect(MAX_PHOTO_BYTES).toBe(524288);
  });

  it("accepts exactly the limit and refuses one byte more", () => {
    expect(fitsLimit(524288)).toBe(true);
    expect(fitsLimit(524289)).toBe(false);
  });

  it("refuses an empty result", () => {
    expect(fitsLimit(0)).toBe(false);
  });
});
