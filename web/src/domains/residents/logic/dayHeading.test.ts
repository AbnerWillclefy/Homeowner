import { afterEach, describe, expect, it } from "vitest";
import { dayHeading, dayHeadingText } from "./dayHeading";

describe("dayHeading", () => {
  it("is today for the Home's date", () => {
    expect(dayHeading("2030-01-15", "2030-01-15")).toEqual({ kind: "today" });
  });

  it("is yesterday for the day before", () => {
    expect(dayHeading("2030-01-14", "2030-01-15")).toEqual({ kind: "yesterday" });
  });

  it("is the date itself, for the weekday, from two to six days back", () => {
    for (const back of [2, 3, 4, 5, 6]) {
      const day = `2030-01-${String(15 - back).padStart(2, "0")}`;
      expect(dayHeading(day, "2030-01-15")).toEqual({ kind: "weekday", day });
    }
  });

  it("counts across a month boundary", () => {
    expect(dayHeading("2026-02-28", "2026-03-01")).toEqual({ kind: "yesterday" });
    expect(dayHeading("2026-02-27", "2026-03-01")).toEqual({ kind: "weekday", day: "2026-02-27" });
  });

  it("counts across the turn of the year", () => {
    expect(dayHeading("2025-12-31", "2026-01-01")).toEqual({ kind: "yesterday" });
    expect(dayHeading("2025-12-30", "2026-01-01")).toEqual({ kind: "weekday", day: "2025-12-30" });
  });

  it("counts a leap day", () => {
    expect(dayHeading("2028-02-29", "2028-03-01")).toEqual({ kind: "yesterday" });
  });

  it("treats text that is not a date as a weekday request, never a crash", () => {
    expect(dayHeading("soon", "2030-01-15")).toEqual({ kind: "weekday", day: "soon" });
  });
});

describe("dayHeadingText", () => {
  const words = { today: "Today", yesterday: "Yesterday" };

  it("names the weekday in the locale, from the calendar date alone", () => {
    expect(dayHeadingText({ kind: "weekday", day: "2030-01-12" }, "en-US", words)).toBe("Saturday");
    expect(dayHeadingText({ kind: "weekday", day: "2030-01-12" }, "pt-BR", words)).toBe("sábado");
  });

  it("uses the given words for today and yesterday", () => {
    expect(dayHeadingText({ kind: "today" }, "pt-BR", { today: "Hoje", yesterday: "Ontem" })).toBe("Hoje");
    expect(dayHeadingText({ kind: "yesterday" }, "pt-BR", { today: "Hoje", yesterday: "Ontem" })).toBe("Ontem");
  });

  describe("whatever the device zone", () => {
    const original = process.env.TZ;
    afterEach(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it.each(["UTC", "America/Sao_Paulo", "Pacific/Kiritimati", "Pacific/Pago_Pago"])("gives the same labels in %s", (zone) => {
      process.env.TZ = zone;
      expect(dayHeading("2030-01-14", "2030-01-15")).toEqual({ kind: "yesterday" });
      expect(dayHeading("2030-01-12", "2030-01-15")).toEqual({ kind: "weekday", day: "2030-01-12" });
      expect(dayHeadingText({ kind: "weekday", day: "2030-01-12" }, "en-US", words)).toBe("Saturday");
    });
  });
});
