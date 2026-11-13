import { describe, expect, it } from "vitest";
import { readSourceName, sourceNameErrorKey } from "./sourceName";

describe("readSourceName", () => {
  it("trims the name", () => expect(readSourceName("  Conta  ")).toEqual({ ok: true, name: "Conta" }));
  it("refuses an empty one", () => expect(readSourceName("   ")).toEqual({ ok: false, code: "required" }));
});

describe("sourceNameErrorKey", () => {
  it("words the API's codes and falls back for an unknown one", () => {
    expect(sourceNameErrorKey("too_long")).toBe("sources.name.too_long");
    expect(sourceNameErrorKey("surprise")).toBe("sources.name.failed");
  });
});
