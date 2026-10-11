import { describe, expect, it } from "vitest";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "./weekdays";

describe("DISPLAY_WEEKDAYS", () => {
  it("is the ISO week: Monday first, Sunday last", () => {
    expect(DISPLAY_WEEKDAYS).toEqual([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ]);
  });
});

describe("weekdayLabel", () => {
  it("names the day in the locale", () => {
    expect(weekdayLabel("monday", "en-US")).toBe("Monday");
    expect(weekdayLabel("sunday", "en-US")).toBe("Sunday");
    expect(weekdayLabel("monday", "pt-BR")).toBe("segunda-feira");
    expect(weekdayLabel("saturday", "pt-BR")).toBe("sábado");
  });
});
