import { describe, expect, it } from "vitest";
import { addMonths, currentMonth, monthLabel } from "./month";

describe("month", () => {
  it("takes the current month from device time", () => {
    expect(currentMonth(new Date(2026, 10, 30, 23, 59))).toBe("2026-11");
    expect(currentMonth(new Date(2026, 0, 1, 0, 0))).toBe("2026-01");
  });
  it("adds months across years", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-05", 0)).toBe("2026-05");
  });
  it("labels the month in the locale", () => {
    expect(monthLabel("2026-11", "en-US")).toBe("November 2026");
    expect(monthLabel("2026-03", "pt-BR")).toBe("março de 2026");
  });
});
