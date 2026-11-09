import { describe, expect, it } from "vitest";
import { formatSyncTime } from "./syncTime";

describe("formatSyncTime", () => {
  it("writes the date and time in the locale and the given zone", () => {
    expect(formatSyncTime("2026-11-08T13:05:00Z", "en-US", "UTC")).toBe("Nov 8, 2026, 1:05 PM");
    const pt = formatSyncTime("2026-11-08T13:05:00Z", "pt-BR", "America/Sao_Paulo");
    expect(pt).toContain("10:05");
    expect(pt).toContain("2026");
  });
});
