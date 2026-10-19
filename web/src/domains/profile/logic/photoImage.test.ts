import { describe, expect, it } from "vitest";
import { ATTEMPTS, cropBox, fitsLimit, isUsable, MAX_PHOTO_BYTES } from "./photoImage";

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

describe("ATTEMPTS", () => {
  it("tries WebP, then JPEG, then a smaller JPEG", () => {
    expect(ATTEMPTS).toEqual([
      ["image/webp", 0.85],
      ["image/jpeg", 0.85],
      ["image/jpeg", 0.7],
    ]);
  });
});

describe("isUsable", () => {
  it("keeps a blob of the type that was asked for", () => {
    expect(isUsable("image/webp", { type: "image/webp", size: 1000 })).toBe(true);
  });

  it("refuses PNG when Safari ignores a WebP or JPEG request", () => {
    expect(isUsable("image/webp", { type: "image/png", size: 1000 })).toBe(false);
    expect(isUsable("image/jpeg", { type: "image/png", size: 1000 })).toBe(false);
    expect(isUsable("image/webp", { type: "", size: 1000 })).toBe(false);
  });

  it("refuses a blob over the limit or empty", () => {
    expect(isUsable("image/jpeg", { type: "image/jpeg", size: 524289 })).toBe(false);
    expect(isUsable("image/jpeg", { type: "image/jpeg", size: 0 })).toBe(false);
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
