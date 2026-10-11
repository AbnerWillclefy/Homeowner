import { describe, expect, it } from "vitest";
import { formatDay } from "./format";

describe("formatDay", () => {
  it("writes a calendar date the way the locale does, whatever the device's time zone", () => {
    expect(formatDay("2026-10-12", "en-US")).toBe("Oct 12");
    expect(formatDay("2026-10-12", "pt-BR")).toBe("12 de out.");
  });

  it("returns text it cannot read as it came", () => {
    expect(formatDay("soon", "en-US")).toBe("soon");
  });
});
