import { describe, expect, it } from "vitest";
import { base64UrlToBytes, bytesEqual } from "./vapidKey";

describe("base64UrlToBytes", () => {
  it("decodes unpadded base64url with - and _ characters", () => {
    // 0xfb 0xff 0xfe is "+//+" in base64 and "-__-" in base64url.
    expect(Array.from(base64UrlToBytes("-__-"))).toEqual([0xfb, 0xff, 0xfe]);
  });

  it("restores missing padding", () => {
    expect(Array.from(base64UrlToBytes("aGk"))).toEqual([0x68, 0x69]); // "hi"
  });
});

describe("bytesEqual", () => {
  it("compares contents, not identity", () => {
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(bytesEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});
