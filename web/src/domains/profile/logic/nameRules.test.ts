import { describe, expect, it } from "vitest";
import { NAME_MAX, checkName } from "./nameRules";

describe("checkName", () => {
  it("allows a plain name and returns it trimmed", () => {
    expect(checkName("  Abner  ")).toEqual({ kind: "ok", name: "Abner", count: 5 });
  });

  it("treats a blank or empty name as a request to clear it", () => {
    expect(checkName("")).toEqual({ kind: "clear", count: 0 });
    expect(checkName("   \t\n")).toEqual({ kind: "clear", count: 0 });
  });

  it("treats a Unicode space (no-break, ideographic) as blank, as the server does", () => {
    expect(checkName(" 　")).toEqual({ kind: "clear", count: 0 });
  });

  it("allows exactly 40 characters and stops 41", () => {
    expect(checkName("a".repeat(40)).kind).toBe("ok");
    expect(checkName("a".repeat(41))).toEqual({ kind: "too_long", count: 41 });
  });

  it("counts the trimmed name, so padding does not count", () => {
    expect(checkName(` ${"a".repeat(40)} `).kind).toBe("ok");
  });

  it("counts 40 accented letters as 40, not as bytes", () => {
    expect(checkName("é".repeat(40))).toMatchObject({ kind: "ok", count: 40 });
    expect(checkName("é".repeat(41)).kind).toBe("too_long");
  });

  it("counts a letter written with a combining accent as two code points, like the server", () => {
    expect(checkName("é".repeat(20))).toMatchObject({ kind: "ok", count: 40 });
    expect(checkName("é".repeat(21)).kind).toBe("too_long");
  });

  it("counts an emoji outside the basic plane once, not as two UTF-16 units", () => {
    const forty = "😀".repeat(40);
    expect(forty.length).toBe(80);
    expect(checkName(forty)).toMatchObject({ kind: "ok", count: 40 });
    expect(checkName("😀".repeat(41)).kind).toBe("too_long");
  });

  it("exposes the limit the counter shows", () => {
    expect(NAME_MAX).toBe(40);
  });
});
