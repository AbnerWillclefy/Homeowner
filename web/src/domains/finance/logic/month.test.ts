import { describe, expect, it } from "vitest";
import { addMonths, currentDay, currentMonth, formatDay, monthFromParam, monthLabel, monthName } from "./month";

describe("monthName", () => {
  it("is the month alone, in the locale", () => {
    expect(monthName("2026-10", "pt-BR")).toBe("Outubro");
    expect(monthName("2026-10", "en-US")).toBe("October");
  });
});

describe("currentDay", () => {
  it("is the device's calendar day, padded", () => {
    expect(currentDay(new Date(2026, 10, 8))).toBe("2026-11-08");
  });
});

describe("formatDay", () => {
  it("writes a posting date as day and month in the locale, with no time zone shift", () => {
    expect(formatDay("2026-11-02", "en-US")).toBe("Nov 2");
    expect(formatDay("2026-11-02", "pt-BR")).toBe("2 de Nov.");
    expect(formatDay("2026-09-28", "pt-BR")).toBe("28 de Set.");
    expect(formatDay("2026-12-05", "pt-BR")).toBe("5 de Dez.");
  });
});

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
    expect(monthLabel("2026-03", "pt-BR")).toBe("Março de 2026");
  });
});

describe("monthFromParam", () => {
  it("keeps a valid month up to this one and falls back to this one otherwise", () => {
    expect(monthFromParam("2026-10", "2026-11")).toBe("2026-10");
    expect(monthFromParam("2026-11", "2026-11")).toBe("2026-11");
    for (const bad of [null, "", "2026-12", "2026-13", "2026-1", "x"]) expect(monthFromParam(bad, "2026-11")).toBe("2026-11");
  });
});
