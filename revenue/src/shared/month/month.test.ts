import { describe, expect, it } from "vitest";
import { addMonths, formatDay, monthFromParam, monthLabel, saoPauloDay } from "./month";

describe("month helpers", () => {
  it("reads the day in São Paulo, not the device's", () => {
    expect(saoPauloDay(new Date("2026-12-01T02:00:00Z"))).toBe("2026-11-30");
  });
  it("adds months across years", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 2)).toBe("2027-01");
  });
  it("falls back to this month for a future or malformed month", () => {
    expect(monthFromParam("2026-09", "2026-11")).toBe("2026-09");
    for (const bad of ["2027-01", "2026-13", "nov", "", null]) expect(monthFromParam(bad, "2026-11")).toBe("2026-11");
  });
  it("capitalises the month name", () => {
    expect(monthLabel("2026-11", "pt-BR")).toBe("Novembro de 2026");
    expect(monthLabel("2026-11", "en")).toBe("November 2026");
  });
  it("writes a posting date as day and short month", () => {
    expect(formatDay("2026-11-05", "en")).toBe("Nov 5");
    expect(formatDay("2026-11-05", "pt-BR")).toBe("5 de nov.");
  });
});
