import { describe, expect, it } from "vitest";
import { readSourceName, sourceNameErrorKey } from "./sourceName";

describe("readSourceName", () => {
  it("trims the name before it is sent", () => {
    expect(readSourceName("  Nubank  ")).toEqual({ ok: true, name: "Nubank" });
  });

  it("refuses an empty or blank name with the API's code", () => {
    expect(readSourceName("")).toEqual({ ok: false, code: "required" });
    expect(readSourceName("   ")).toEqual({ ok: false, code: "required" });
  });
});

describe("sourceNameErrorKey", () => {
  it("names required, too_long and invalid, and gives any other code the generic failure", () => {
    expect(sourceNameErrorKey("required")).toBe("finances.sourceName.required");
    expect(sourceNameErrorKey("too_long")).toBe("finances.sourceName.too_long");
    expect(sourceNameErrorKey("invalid")).toBe("finances.sourceName.invalid");
    expect(sourceNameErrorKey("surprise")).toBe("finances.billDays.failed");
  });
});
