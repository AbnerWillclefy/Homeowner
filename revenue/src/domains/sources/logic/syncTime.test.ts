import { describe, expect, it } from "vitest";
import { formatSyncTime } from "./syncTime";

describe("formatSyncTime", () => {
  it("writes the date and time in the locale and the given zone", () => {
    expect(formatSyncTime("2026-11-08T13:05:00Z", "en", "UTC").replace(/\s/g, " ")).toBe("Nov 8, 2026, 1:05 PM");
    expect(formatSyncTime("2026-11-08T13:05:00Z", "pt-BR", "America/Sao_Paulo")).toContain("10:05");
  });
});
